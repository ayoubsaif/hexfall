// The client side of protocol v3 (specs/client-session, design.md decision 7).
// The only writer of the room and game stores: it turns server messages into store
// state and UI intents into client messages. Framework-free and driven by injected
// fakes in tests.
import type { ClientAction, ErrorCode, ServerMessage, TurnTimerPreset } from "@hexfall/protocol";
import { resetGame, useGameStore } from "../store/game.ts";
import { resetRoom, useRoomStore, type RoomRequest } from "../store/room.ts";
import { resetUi } from "../store/ui.ts";
import type { BoardModeChoice, SessionApi } from "./actions.ts";
import { createAddress, type Address } from "./address.ts";
import type { Connection, ConnectionStatus, Timers } from "./connection.ts";
import { createSeatStorage, normalizeRoom, type SeatStorage } from "./seatStorage.ts";

/** Monotonic local clock for countdowns (store/game.ts `timerAt`). */
const now = (): number => (typeof performance === "undefined" ? Date.now() : performance.now());

/** The parts of `Connection` the session uses. */
export type SessionConnection = Pick<Connection, "status" | "send" | "restart">;

export interface SessionOptions {
  connection: SessionConnection;
  seats?: SeatStorage;
  address?: Address;
  timers?: Pick<Timers, "setTimeout" | "clearTimeout">;
  log?: (msg: string, detail?: unknown) => void;
  /** Safety timeout that clears a stuck in-flight action (ms). */
  inFlightTimeoutMs?: number;
}

export const NAME_MAX = 20;
export const IN_FLIGHT_TIMEOUT_MS = 10_000;
export const SEAT_LOST_NOTICE = "Your seat could not be restored.";

/** Trimmed display name if it passes the client-side check (1–20 characters), else null. */
export function cleanName(name: string): string | null {
  const n = name.trim();
  return n.length >= 1 && n.length <= NAME_MAX ? n : null;
}

type TimerId = ReturnType<Timers["setTimeout"]>;

export class SessionController implements SessionApi {
  private readonly conn: SessionConnection;
  private readonly seats: SeatStorage;
  private readonly address: Address;
  private readonly timers: Pick<Timers, "setTimeout" | "clearTimeout">;
  private readonly log: (msg: string, detail?: unknown) => void;
  private readonly inFlightMs: number;

  /** Room code of the resume request waiting for an answer. */
  private resuming: string | null = null;
  private inFlightTimer: TimerId | null = null;
  private rejectionId = 0;

  constructor(opts: SessionOptions) {
    this.conn = opts.connection;
    this.seats = opts.seats ?? createSeatStorage();
    this.address = opts.address ?? createAddress();
    this.timers = opts.timers ?? {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (id) => globalThis.clearTimeout(id),
    };
    this.log = opts.log ?? ((msg, detail) => console.warn(`[session] ${msg}`, detail ?? ""));
    this.inFlightMs = opts.inFlightTimeoutMs ?? IN_FLIGHT_TIMEOUT_MS;
    // An invite link prefills the join form even before the first welcome.
    const fromAddress = this.address.room();
    if (fromAddress && !this.seats.token(fromAddress)) {
      useRoomStore.setState({ prefillRoom: fromAddress });
    }
  }

  /** Invite link for the current room, or null. */
  inviteLink(): string | null {
    const room = useRoomStore.getState().room;
    return room ? this.address.inviteLink(room) : null;
  }

  // ---- connection events

  /** Every `welcome` (first connect, reconnect, restart): resume a saved seat first. */
  onWelcome(): void {
    this.endInFlight();
    useRoomStore.setState({ pending: null });
    const fromAddress = this.address.room();
    let target: string | null = null;
    if (fromAddress) {
      if (this.seats.token(fromAddress)) target = fromAddress;
    } else {
      const last = this.seats.lastRoom();
      if (last && this.seats.token(last)) target = last;
    }
    if (target) {
      const token = this.seats.token(target) as string;
      this.resuming = target;
      this.conn.send("resumeRoom", { room: target, token });
      return;
    }
    this.resuming = null;
    // Nothing to resume: this connection holds no seat.
    if (useRoomStore.getState().room !== null) this.clearAll();
    if (fromAddress) useRoomStore.setState({ prefillRoom: fromAddress });
  }

  onStatus(status: ConnectionStatus): void {
    if (status === "open") return;
    this.endInFlight();
    this.resuming = null;
    if (useRoomStore.getState().pending !== null) useRoomStore.setState({ pending: null });
  }

  onMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "roomJoined": {
        const { room, seat, token } = msg.payload;
        if (token) this.seats.save(room, token);
        this.seats.setLastRoom(room);
        this.address.setRoom(room);
        this.resuming = null;
        useRoomStore.setState({
          room,
          seat,
          pending: null,
          error: null,
          notice: null,
          prefillRoom: null,
        });
        break;
      }
      case "roomState": {
        const { room, status, host, seats } = msg.payload;
        useRoomStore.setState({ room, status, host, seats });
        // Back in a lobby (e.g. resumed before the start): no game to show.
        if (status === "lobby" && useGameStore.getState().view !== null) resetGame();
        break;
      }
      case "roomLeft": {
        this.seats.forget(msg.payload.room);
        this.address.setRoom(null);
        this.clearAll();
        break;
      }
      case "gameSnapshot": {
        const { version, view, legal, timer } = msg.payload;
        this.endInFlight();
        useGameStore.setState({
          version,
          view,
          legal,
          timer,
          timerAt: now(),
          log: view.log,
          lastEvents: [],
          source: "snapshot",
          inFlight: false,
        });
        break;
      }
      case "gameUpdate": {
        const { version, view, legal, events, logLength, timer } = msg.payload;
        const g = useGameStore.getState();
        if (version <= g.version) break; // old or repeated update
        if (g.log.length + events.length !== logLength) {
          // A missed update: reload everything from a fresh snapshot.
          this.log(`log gap (have ${g.log.length}, +${events.length}, server ${logLength})`);
          this.endInFlight();
          this.conn.restart();
          break;
        }
        this.endInFlight();
        useGameStore.setState({
          version,
          view,
          legal,
          log: [...g.log, ...events],
          lastEvents: events,
          timer,
          timerAt: now(),
          source: "update",
          inFlight: false,
        });
        break;
      }
      case "actionRejected": {
        this.endInFlight();
        const { code, message } = msg.payload;
        useGameStore.setState({ rejection: { code, message, id: ++this.rejectionId } });
        break;
      }
      case "error":
        this.onError(msg.payload.code, msg.payload.message);
        break;
      default:
        break;
    }
  }

  private onError(code: ErrorCode, message: string): void {
    if (this.resuming) {
      const room = this.resuming;
      this.resuming = null;
      if (code === "bad_token" || code === "room_not_found") {
        this.seats.forget(room);
        if (this.address.room() === room) this.address.setRoom(null);
        this.clearAll();
        useRoomStore.setState({ notice: SEAT_LOST_NOTICE });
        return;
      }
      if (code === "already_in_room") return; // this connection already holds the seat
      useRoomStore.setState({ error: { request: "resume", code, message } });
      return;
    }
    const pending = useRoomStore.getState().pending;
    if (pending) {
      useRoomStore.setState({ pending: null, error: { request: pending, code, message } });
      return;
    }
    if (useGameStore.getState().inFlight) {
      this.endInFlight();
      // Server errors on a game action (unavailable, rate_limited, no_seat) are shown like
      // rule rejections.
      useGameStore.setState({
        rejection: { code, message, id: ++this.rejectionId },
      });
      return;
    }
    this.log(`server error ${code}: ${message}`);
  }

  // ---- intents (SessionApi)

  act(action: ClientAction): boolean {
    if (useGameStore.getState().inFlight || this.conn.status !== "open") return false;
    if (!this.conn.send("gameAction", { action })) return false;
    useGameStore.setState({ inFlight: true });
    this.inFlightTimer = this.timers.setTimeout(() => {
      this.inFlightTimer = null;
      if (useGameStore.getState().inFlight) {
        this.log("no reply to a game action; unlocking controls");
        useGameStore.setState({ inFlight: false });
      }
    }, this.inFlightMs);
    return true;
  }

  createRoom(name: string): boolean {
    const n = cleanName(name);
    if (!n) return false;
    return this.request("create", () => this.conn.send("createRoom", { name: n }));
  }

  joinRoom(room: string, name: string): boolean {
    const n = cleanName(name);
    const code = normalizeRoom(room);
    if (!n || code.length === 0) return false;
    return this.request("join", () => this.conn.send("joinRoom", { room: code, name: n }));
  }

  leaveRoom(): boolean {
    if (useRoomStore.getState().room === null) return false;
    return this.request("leave", () => this.conn.send("leaveRoom", {}));
  }

  startGame(mode: BoardModeChoice, startingPlayer?: number, turnTimer?: TurnTimerPreset): boolean {
    return this.request("start", () =>
      this.conn.send("startGame", {
        mode,
        ...(startingPlayer === undefined ? {} : { startingPlayer }),
        ...(turnTimer === undefined ? {} : { turnTimer }),
      }),
    );
  }

  playHere(): void {
    this.conn.restart();
  }

  backToStart(): void {
    const room = useRoomStore.getState().room;
    if (room) this.seats.forget(room);
    this.address.setRoom(null);
    this.resuming = null;
    this.clearAll();
    useRoomStore.setState({ prefillRoom: null, notice: null });
    this.conn.restart();
  }

  // ---- helpers

  private request(kind: RoomRequest, send: () => boolean): boolean {
    const room = useRoomStore.getState();
    if (this.conn.status !== "open" || room.pending !== null) return false;
    if (!send()) return false;
    useRoomStore.setState({ pending: kind, error: null, notice: null });
    return true;
  }

  private endInFlight(): void {
    if (this.inFlightTimer !== null) this.timers.clearTimeout(this.inFlightTimer);
    this.inFlightTimer = null;
    if (useGameStore.getState().inFlight) useGameStore.setState({ inFlight: false });
  }

  /** Back to "not in a room": room, game and UI intent cleared (prefill and notice kept). */
  private clearAll(): void {
    this.endInFlight();
    resetRoom();
    resetGame();
    resetUi();
  }
}
