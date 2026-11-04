import type { GameEvent, RuleErrorCode } from "@hexfall/engine";
import { z } from "zod";
import { envelopeShape } from "./envelope.ts";
import { ClientActionSchema, LegalActionsSchema, PlayerViewSchema } from "./game.ts";

const msg = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.object({ ...envelopeShape, type: z.literal(type), payload });

/** Room code as typed by a user; the server upper-cases and validates it. */
const RoomCode = z.string().min(1).max(16);
const Seat = z.number().int().min(0).max(3);
const Name = z.string().max(64);

/** Turn timer presets (game-server "Turn timer"). The host picks one at start; fixed after. */
export const TurnTimerPreset = z.enum(["off", "standard", "relaxed"]);
export type TurnTimerPreset = z.infer<typeof TurnTimerPreset>;

/** Milliseconds per wait kind: `roll` (dice / roll for order) and `action` (every other wait). */
export const TURN_TIMER_PRESETS: Readonly<
  Record<Exclude<TurnTimerPreset, "off">, { roll: number; action: number }>
> = Object.freeze({
  standard: Object.freeze({ roll: 30_000, action: 90_000 }),
  relaxed: Object.freeze({ roll: 60_000, action: 120_000 }),
});

/**
 * The running countdown, as sent with every snapshot and update. `remainingMs` is measured
 * on the server clock when the message is built; clients add it to their own receipt time.
 * Null when the timer is off or the game has ended.
 */
export const TimerInfo = z
  .object({
    kind: z.enum(["roll", "action"]),
    durationMs: z.number().int().nonnegative(),
    remainingMs: z.number().int().nonnegative(),
    /** Seats the game is waiting for. */
    seats: z.array(Seat),
  })
  .nullable();
export type TimerInfo = z.infer<typeof TimerInfo>;

// ---- client -> server
export const HelloMessage = msg("hello", z.object({ clientVersion: z.string().min(1) }));
export const PingMessage = msg("ping", z.object({ t: z.number() }));
export const CreateRoomMessage = msg("createRoom", z.object({ name: Name }));
export const JoinRoomMessage = msg("joinRoom", z.object({ room: RoomCode, name: Name }));
export const ResumeRoomMessage = msg(
  "resumeRoom",
  z.object({ room: RoomCode, token: z.string().min(1).max(128) }),
);
export const LeaveRoomMessage = msg("leaveRoom", z.object({}));
export const StartGameMessage = msg(
  "startGame",
  z.object({
    mode: z.enum(["beginner", "variable"]),
    startingPlayer: Seat.optional(),
    /** Defaults to "off". */
    turnTimer: TurnTimerPreset.optional(),
  }),
);
export const GameActionMessage = msg("gameAction", z.object({ action: ClientActionSchema }));

export const ClientMessage = z.discriminatedUnion("type", [
  HelloMessage,
  PingMessage,
  CreateRoomMessage,
  JoinRoomMessage,
  ResumeRoomMessage,
  LeaveRoomMessage,
  StartGameMessage,
  GameActionMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---- server -> client
export const WelcomeMessage = msg(
  "welcome",
  z.object({ serverVersion: z.string(), protocolVersion: z.number().int() }),
);
export const PongMessage = msg("pong", z.object({ t: z.number() }));
export const ErrorCode = z.enum([
  "bad_frame",
  "version_mismatch",
  "internal",
  "bad_name",
  "room_not_found",
  "room_full",
  "game_started",
  "not_host",
  "not_enough_players",
  "bad_token",
  "no_seat",
  "already_in_room",
  "unavailable",
  "rate_limited",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ErrorMessage = msg("error", z.object({ code: ErrorCode, message: z.string() }));

export const RoomStatus = z.enum(["lobby", "playing", "ended"]);
export type RoomStatus = z.infer<typeof RoomStatus>;
export const SeatInfo = z.object({ seat: Seat, name: z.string(), connected: z.boolean() });
export type SeatInfo = z.infer<typeof SeatInfo>;

/** `token` is present only on create and join (never on resume). */
export const RoomJoinedMessage = msg(
  "roomJoined",
  z.object({ room: z.string(), seat: Seat, token: z.string().optional() }),
);
export const RoomLeftMessage = msg("roomLeft", z.object({ room: z.string() }));
export const RoomStateMessage = msg(
  "roomState",
  z.object({ room: z.string(), status: RoomStatus, host: Seat, seats: z.array(SeatInfo) }),
);
/** Full view (with the whole redacted log), sent on start, join and resume. */
export const GameSnapshotMessage = msg(
  "gameSnapshot",
  z.object({
    version: z.number().int().nonnegative(),
    view: PlayerViewSchema,
    legal: LegalActionsSchema,
    timer: TimerInfo,
  }),
);
/** After each accepted action: `view.log` is empty; `events` are the new redacted entries. */
export const GameUpdateMessage = msg(
  "gameUpdate",
  z.object({
    version: z.number().int().nonnegative(),
    view: PlayerViewSchema,
    events: z.array(z.custom<GameEvent>((v) => typeof v === "object" && v !== null)),
    logLength: z.number().int().nonnegative(),
    legal: LegalActionsSchema,
    timer: TimerInfo,
  }),
);
/** An engine rule error, sent only to the player whose action failed. */
export const ActionRejectedMessage = msg(
  "actionRejected",
  z.object({ code: z.custom<RuleErrorCode>((v) => typeof v === "string"), message: z.string() }),
);

export const ServerMessage = z.discriminatedUnion("type", [
  WelcomeMessage,
  PongMessage,
  ErrorMessage,
  RoomJoinedMessage,
  RoomLeftMessage,
  RoomStateMessage,
  GameSnapshotMessage,
  GameUpdateMessage,
  ActionRejectedMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export type ClientMessageType = ClientMessage["type"];
export type ServerMessageType = ServerMessage["type"];
/** Payload type of a message type. */
export type PayloadOf<M extends { type: string; payload: unknown }, T extends M["type"]> = Extract<
  M,
  { type: T }
>["payload"];
