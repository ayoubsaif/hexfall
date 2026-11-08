// The client side of protocol v3 (specs/client-session, design.md decision 7).
// The only writer of the room and game stores: it turns server messages into store
// state and UI intents into client messages. Framework-free and driven by injected
// fakes in tests.
import {
  MAX_LOOKUP_SEATS,
  type AvatarId,
  type BotLevel,
  type ClientAction,
  type ErrorCode,
  type RoomStatus,
  type SeatInfoEntry,
  type ServerMessage,
  type TurnTimerPreset,
} from "@hexfall/protocol";
import { addChatLine, resetChat, setChatHistory } from "../store/chat.ts";
import { resetGame, useGameStore } from "../store/game.ts";
import { isFrozen, resetRoom, useRoomStore, type RoomRequest } from "../store/room.ts";
import { sortSaved, useSavedGamesStore, type SavedGame } from "../store/savedGames.ts";
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
  /** Called after every `roomJoined` (create, join, resume), once the room store is updated. */
  onSeated?: () => void;
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

/** The room status that completes each host request. */
const REQUEST_DONE: Partial<Record<RoomRequest, RoomStatus>> = {
  pause: "paused",
  resume: "playing",
  end: "ended",
};

export class SessionController implements SessionApi {
  private readonly conn: SessionConnection;
  private readonly seats: SeatStorage;
  private readonly address: Address;
  private readonly timers: Pick<Timers, "setTimeout" | "clearTimeout">;
  private readonly log: (msg: string, detail?: unknown) => void;
  private readonly inFlightMs: number;
  private readonly onSeated: (() => void) | undefined;

  /** Room code of the resume request waiting for an answer. */
  private resuming: string | null = null;
  /** Host request (pause, resume, end) waiting for the room state it leads to. */
  private roomRequest: RoomRequest | null = null;
  /** Bots to seat (then start) as soon as the room created for "Play solo" is joined. */
  private soloOpponents: 2 | 3 | null = null;
  /** A `lookupSeats` was sent and not answered. */
  private lookingUp = false;
  /** Room of an `endSavedGame` sent and not answered. */
  private ending: string | null = null;
  private inFlightTimer: TimerId | null = null;
  private rejectionId = 0;

  constructor(opts: SessionOptions) {
    this.conn = opts.connection;
    this.onSeated = opts.onSeated;
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
    this.roomRequest = null;
    this.soloOpponents = null;
    if (this.ending !== null) {
      this.ending = null;
      useSavedGamesStore.setState({ ending: null });
    }
    if (this.lookingUp) {
      this.lookingUp = false;
      useSavedGamesStore.setState({ loading: false });
    }
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
        this.onSeated?.();
        // "Play solo": the room is ours, so seat the bots and start at once. The server
        // handles these in order, so no reply is awaited in between.
        if (this.soloOpponents !== null && token) {
          const n = this.soloOpponents;
          this.soloOpponents = null;
          for (let i = 0; i < n; i++) this.conn.send("addBot", {});
          this.startGame("variable", undefined, "off");
        }
        break;
      }
      case "roomState": {
        const { room, status, host, seats, pausedAt, result } = msg.payload;
        useRoomStore.setState({ room, status, host, seats, pausedAt, result });
        // Back in a lobby (e.g. resumed before the start): no game to show.
        if (status === "lobby" && useGameStore.getState().view !== null) resetGame();
        // Paused or ended by the host: no move can be sent until a playing snapshot arrives.
        if (isFrozen({ status, result })) this.freeze();
        if (this.roomRequest && REQUEST_DONE[this.roomRequest] === status) this.endRoomRequest();
        break;
      }
      case "chatLine": {
        addChatLine(msg.payload.entry, useRoomStore.getState().seat);
        break;
      }
      case "chatHistory": {
        setChatHistory(msg.payload.entries);
        break;
      }
      case "seatsInfo": {
        this.onSeatsInfo(msg.payload.rooms);
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
        const frozen = isFrozen(useRoomStore.getState());
        useGameStore.setState({
          version,
          view,
          legal: frozen ? null : legal,
          timer: frozen ? null : timer,
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
        const frozen = isFrozen(useRoomStore.getState());
        useGameStore.setState({
          version,
          view,
          legal: frozen ? null : legal,
          log: [...g.log, ...events],
          lastEvents: events,
          timer: frozen ? null : timer,
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
    this.soloOpponents = null;
    if (this.ending !== null) {
      const room = this.ending;
      this.ending = null;
      useSavedGamesStore.setState({ ending: null, error: { room, code, message } });
      return;
    }
    if (
      this.lookingUp &&
      !this.resuming &&
      useRoomStore.getState().pending === null &&
      !useGameStore.getState().inFlight
    ) {
      // The lookup failed (unavailable): keep the last list, stop loading.
      this.lookingUp = false;
      useSavedGamesStore.setState({ loading: false });
      return;
    }
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
      this.roomRequest = null;
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

  /** Keeps the listed rooms and forgets those the server reports gone or ended. */
  private onSeatsInfo(rooms: readonly SeatInfoEntry[]): void {
    const used = new Map(this.seats.list().map((s) => [s.room, s.usedAt]));
    const ended = this.ending;
    if (ended !== null && rooms.length === 1 && rooms[0]?.room === ended) {
      // Answer to "End" in the list: update that one entry (an ended room drops out).
      this.ending = null;
      const entry = rooms[0];
      const rest = useSavedGamesStore.getState().entries.filter((e) => e.room !== ended);
      if (entry.status === "gone" || entry.status === "ended") this.seats.forget(ended);
      else if (used.has(ended)) rest.push({ ...entry, usedAt: used.get(ended) ?? 0 });
      useSavedGamesStore.setState({ entries: sortSaved(rest), ending: null, error: null });
      return;
    }
    this.lookingUp = false;
    const entries: SavedGame[] = [];
    for (const r of rooms) {
      if (r.status === "gone" || r.status === "ended") {
        this.seats.forget(r.room);
        continue;
      }
      // Removed locally while the lookup was in flight.
      if (!used.has(r.room)) continue;
      entries.push({ ...r, usedAt: used.get(r.room) ?? 0 });
    }
    useSavedGamesStore.setState({ entries: sortSaved(entries), loading: false });
  }

  /** Disables every game control while the room is frozen. */
  private freeze(): void {
    this.endInFlight();
    const g = useGameStore.getState();
    if (g.legal !== null || g.timer !== null) useGameStore.setState({ legal: null, timer: null });
  }

  private endRoomRequest(): void {
    const pending = useRoomStore.getState().pending;
    if (pending === this.roomRequest) useRoomStore.setState({ pending: null });
    this.roomRequest = null;
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

  createRoom(name: string, avatar?: AvatarId): boolean {
    const n = cleanName(name);
    if (!n) return false;
    return this.request("create", () =>
      this.conn.send("createRoom", avatar ? { name: n, avatar } : { name: n }),
    );
  }

  playSolo(name: string, opponents: 2 | 3, avatar?: AvatarId): boolean {
    const n = cleanName(name);
    if (!n) return false;
    const sent = this.request("create", () =>
      this.conn.send("createRoom", avatar ? { name: n, avatar } : { name: n }),
    );
    if (sent) this.soloOpponents = opponents;
    return sent;
  }

  chat(text: string): boolean {
    if (useRoomStore.getState().room === null || this.conn.status !== "open") return false;
    return this.conn.send("chat", { text });
  }

  addBot(): boolean {
    if (useRoomStore.getState().room === null || this.conn.status !== "open") return false;
    return this.conn.send("addBot", {});
  }

  removeBot(seat: number): boolean {
    if (useRoomStore.getState().room === null || this.conn.status !== "open") return false;
    return this.conn.send("removeBot", { seat });
  }

  setBotLevel(seat: number, level: BotLevel): boolean {
    if (useRoomStore.getState().room === null || this.conn.status !== "open") return false;
    return this.conn.send("setBotLevel", { seat, level });
  }

  joinRoom(room: string, name: string, avatar?: AvatarId): boolean {
    const n = cleanName(name);
    const code = normalizeRoom(room);
    if (!n || code.length === 0) return false;
    return this.request("join", () =>
      this.conn.send(
        "joinRoom",
        avatar ? { room: code, name: n, avatar } : { room: code, name: n },
      ),
    );
  }

  setAvatar(avatar: AvatarId): boolean {
    if (useRoomStore.getState().room === null || this.conn.status !== "open") return false;
    return this.conn.send("setAvatar", { avatar });
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

  pauseGame(): boolean {
    return this.hostRequest("pause", "pauseGame");
  }

  resumeGame(): boolean {
    return this.hostRequest("resume", "resumeGame");
  }

  endGame(): boolean {
    return this.hostRequest("end", "endGame");
  }

  /** Asks the server about every saved seat (start screen). False when nothing was sent. */
  lookupSeats(): boolean {
    const saved = this.seats
      .list()
      .sort((a, b) => b.usedAt - a.usedAt)
      .slice(0, MAX_LOOKUP_SEATS);
    if (saved.length === 0) {
      useSavedGamesStore.setState({ entries: [], loading: false });
      return false;
    }
    if (this.conn.status !== "open") return false;
    const seats = saved.map(({ room, token }) => ({ room, token }));
    if (!this.conn.send("lookupSeats", { seats })) return false;
    this.lookingUp = true;
    useSavedGamesStore.setState({ loading: true });
    return true;
  }

  /** "Continue" in the saved games list: resume that seat with its stored token. */
  continueGame(room: string): boolean {
    const token = this.seats.token(room);
    if (!token || this.conn.status !== "open" || useRoomStore.getState().room !== null) {
      return false;
    }
    const code = normalizeRoom(room);
    if (!this.conn.send("resumeRoom", { room: code, token })) return false;
    this.resuming = code;
    useRoomStore.setState({ error: null, notice: null });
    return true;
  }

  /** "End" in the saved games list (host only): end that game without taking the seat. */
  endSavedGame(room: string): boolean {
    const code = normalizeRoom(room);
    const token = this.seats.token(code);
    if (!token || this.conn.status !== "open" || this.ending !== null) return false;
    if (!this.conn.send("endSavedGame", { room: code, token })) return false;
    this.ending = code;
    useSavedGamesStore.setState({ ending: code, error: null });
    return true;
  }

  /** "Remove" in the saved games list: forget the seat locally (the room is unchanged). */
  forgetGame(room: string): void {
    const code = normalizeRoom(room);
    this.seats.forget(code);
    const { entries } = useSavedGamesStore.getState();
    useSavedGamesStore.setState({ entries: entries.filter((e) => e.room !== code) });
  }

  playHere(): void {
    this.conn.restart();
  }

  /**
   * Back to the start screen. After a game over the seat is forgotten; with `keepSeat` (a paused
   * game) only the auto-resume is dropped, so the room stays in the saved games list.
   */
  backToStart(opts?: { keepSeat?: boolean }): void {
    const room = useRoomStore.getState().room;
    if (room && opts?.keepSeat) {
      if (this.seats.lastRoom() === room) this.seats.setLastRoom(null);
    } else if (room) {
      this.seats.forget(room);
    }
    this.address.setRoom(null);
    this.resuming = null;
    this.clearAll();
    useRoomStore.setState({ prefillRoom: null, notice: null });
    this.conn.restart();
  }

  // ---- helpers

  /** pause/resume/end: done when the next roomState arrives (or an error). */
  private hostRequest(kind: RoomRequest, type: "pauseGame" | "resumeGame" | "endGame"): boolean {
    if (useRoomStore.getState().room === null) return false;
    const sent = this.request(kind, () => this.conn.send(type, {}));
    if (sent) this.roomRequest = kind;
    return sent;
  }

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
    resetChat();
  }
}
