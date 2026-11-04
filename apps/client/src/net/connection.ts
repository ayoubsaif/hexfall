// Framework-free WebSocket connection to the authoritative server.
// Every dependency with side effects (socket, timers, clock, randomness) is
// injected so the class can be driven by a fake socket in unit tests.
import {
  CloseCode,
  decodeServerMessage,
  encodeClient,
  type ClientMessage,
  type ServerMessage,
} from "@hexfall/protocol";

export type ConnectionStatus =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "version_mismatch"
  /** Another connection resumed this seat (close code 4001): no reconnect until "Play here". */
  | "replaced";

/** The subset of the DOM `WebSocket` this module uses. */
export interface SocketLike {
  readonly readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type SocketFactory = new (url: string) => SocketLike;

type TimerId = ReturnType<typeof globalThis.setTimeout>;

export interface Timers {
  setTimeout(fn: () => void, ms: number): TimerId;
  clearTimeout(id: TimerId): void;
  setInterval(fn: () => void, ms: number): TimerId;
  clearInterval(id: TimerId): void;
}

/** Callbacks through which the connection reports state. The app wires these to the stores. */
export interface ConnectionListener {
  status?(status: ConnectionStatus, attempts: number): void;
  welcome?(info: { serverVersion: string; protocolVersion: number }): void;
  latency?(ms: number): void;
  message?(msg: ServerMessage): void;
}

export interface ConnectionOptions {
  /** Base server URL, e.g. `ws://localhost:8080`. `/ws` is appended. */
  serverUrl: string;
  clientVersion: string;
  listener?: ConnectionListener;
  WebSocket?: SocketFactory;
  timers?: Timers;
  now?: () => number;
  random?: () => number;
  log?: (msg: string, detail?: unknown) => void;
  pingIntervalMs?: number;
  backoffBaseMs?: number;
  backoffCapMs?: number;
}

const OPEN = 1;

export const PING_INTERVAL_MS = 5000;
export const BACKOFF_BASE_MS = 500;
export const BACKOFF_CAP_MS = 10_000;

/**
 * Delay before reconnect attempt number `attempt` (1-based): exponential growth
 * capped at `cap`, with "equal jitter" so the result is in [exp/2, exp].
 */
export function backoffDelay(
  attempt: number,
  random: () => number,
  base = BACKOFF_BASE_MS,
  cap = BACKOFF_CAP_MS,
): number {
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + random() * (exp / 2));
}

/** Joins the base URL and the `/ws` path without doubling slashes. */
export function wsUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, "")}/ws`;
}

export class Connection {
  readonly url: string;
  private readonly opts: ConnectionOptions;
  private readonly Socket: SocketFactory;
  private readonly timers: Timers;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly log: (msg: string, detail?: unknown) => void;
  private readonly listener: ConnectionListener;

  private socket: SocketLike | null = null;
  private pingTimer: TimerId | null = null;
  private reconnectTimer: TimerId | null = null;
  /** Reconnect attempts since the last `welcome`. */
  private attempts = 0;
  /** Set once the connection must not reconnect any more (closed by us, or version mismatch). */
  private stopped = false;
  private _status: ConnectionStatus = "closed";
  /** Next outbound `seq` (monotonic for the lifetime of this object). */
  private nextSeq = 0;
  /** Highest `seq` received from the server on the current socket. */
  lastServerSeq = -1;

  constructor(opts: ConnectionOptions) {
    this.opts = opts;
    this.url = wsUrl(opts.serverUrl);
    this.Socket = opts.WebSocket ?? (globalThis.WebSocket as unknown as SocketFactory);
    this.timers = opts.timers ?? {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (id) => globalThis.clearTimeout(id),
      setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
      clearInterval: (id) => globalThis.clearInterval(id),
    };
    this.now = opts.now ?? (() => Date.now());
    this.random = opts.random ?? Math.random;
    this.log = opts.log ?? ((msg, detail) => console.warn(`[net] ${msg}`, detail ?? ""));
    this.listener = opts.listener ?? {};
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  /** Opens the socket. Safe to call once; later calls are ignored while active. */
  start(): void {
    if (this.socket || this.reconnectTimer !== null || this.stopped) return;
    this.setStatus("connecting");
    this.open();
  }

  /**
   * Drops the current socket (if any) and opens a new one at once, without backoff.
   * Also works after a Replaced close or `close()`. Not after a version mismatch.
   */
  restart(): void {
    if (this._status === "version_mismatch") return;
    this.stopped = false;
    this.teardown();
    this.attempts = 0;
    this.setStatus("connecting");
    this.open();
  }

  /** Closes for good: no reconnect afterwards. */
  close(): void {
    if (this._status === "version_mismatch") return;
    this.stopped = true;
    this.teardown();
    this.setStatus("closed");
  }

  /** Sends a client message. Returns false if the socket is not open. */
  send<T extends ClientMessage["type"]>(
    type: T,
    payload: Extract<ClientMessage, { type: T }>["payload"],
  ): boolean {
    const s = this.socket;
    if (!s || s.readyState !== OPEN) return false;
    s.send(encodeClient(type, payload as never, this.nextSeq++));
    return true;
  }

  // ---- internals

  private open(): void {
    let s: SocketLike;
    try {
      s = new this.Socket(this.url);
    } catch (err) {
      this.log("socket construction failed", err);
      this.scheduleReconnect();
      return;
    }
    this.socket = s;
    this.lastServerSeq = -1;
    s.onopen = () => {
      if (this.socket !== s) return;
      this.send("hello", { clientVersion: this.opts.clientVersion });
    };
    s.onmessage = (ev) => {
      if (this.socket !== s) return;
      this.handleFrame(ev.data);
    };
    s.onerror = () => {
      // A close event always follows; reconnect is handled there.
    };
    s.onclose = (ev) => {
      if (this.socket !== s) return;
      this.detach();
      if (ev.code === CloseCode.VersionMismatch) {
        this.versionMismatch();
        return;
      }
      if (ev.code === CloseCode.Replaced) {
        // Another connection resumed this seat: reconnecting would steal it back.
        this.stopped = true;
        this.teardown();
        this.setStatus("replaced");
        return;
      }
      if (this.stopped) return;
      // 1012 (server restarting), 1006 (network drop) and anything else: retry.
      this.scheduleReconnect();
    };
  }

  private handleFrame(data: unknown): void {
    if (typeof data !== "string") {
      this.log("ignored non-text frame");
      return;
    }
    const res = decodeServerMessage(data);
    if (!res.ok) {
      if (res.error === "version_mismatch") {
        this.versionMismatch();
        return;
      }
      this.log(`ignored invalid frame: ${res.detail}`);
      return;
    }
    const msg = res.message;
    if (msg.seq > this.lastServerSeq) this.lastServerSeq = msg.seq;
    switch (msg.type) {
      case "welcome":
        this.attempts = 0;
        this.listener.welcome?.(msg.payload);
        this.setStatus("open");
        this.startPing();
        break;
      case "pong":
        this.listener.latency?.(Math.max(0, this.now() - msg.payload.t));
        break;
      case "error":
        if (msg.payload.code === "version_mismatch") {
          this.versionMismatch();
          return;
        }
        this.log(`server error ${msg.payload.code}: ${msg.payload.message}`);
        break;
    }
    this.listener.message?.(msg);
  }

  private startPing(): void {
    this.stopPing();
    const ping = () => this.send("ping", { t: this.now() });
    ping();
    this.pingTimer = this.timers.setInterval(ping, this.opts.pingIntervalMs ?? PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) this.timers.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) return;
    this.attempts += 1;
    this.setStatus("reconnecting");
    const delay = backoffDelay(
      this.attempts,
      this.random,
      this.opts.backoffBaseMs ?? BACKOFF_BASE_MS,
      this.opts.backoffCapMs ?? BACKOFF_CAP_MS,
    );
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped) this.open();
    }, delay);
  }

  private versionMismatch(): void {
    this.stopped = true;
    this.teardown();
    this.setStatus("version_mismatch");
  }

  /** Forgets the current socket without closing it (it is already closed). */
  private detach(): void {
    this.stopPing();
    const s = this.socket;
    if (s) {
      s.onopen = null;
      s.onmessage = null;
      s.onclose = null;
      s.onerror = null;
    }
    this.socket = null;
  }

  private teardown(): void {
    if (this.reconnectTimer !== null) this.timers.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const s = this.socket;
    this.detach();
    try {
      s?.close(1000, "client closing");
    } catch {
      // ignore
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this._status === "version_mismatch") return;
    this._status = status;
    this.listener.status?.(status, this.attempts);
  }
}
