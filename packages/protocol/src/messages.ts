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

/**
 * Avatar catalog (player-avatars). Ids map to `/avatars/<id>.webp` on the client; the server
 * only validates membership. Order matters: the first free id is assigned by default.
 */
export const AVATAR_IDS = [
  "villager-beard",
  "herbalist",
  "farmer",
  "weaver",
  "shepherd",
  "baker",
  "woodcutter",
  "shepherdess",
  "blacksmith",
  "innkeeper",
  "fisher",
  "water-carrier",
] as const;
export const AvatarId = z.enum(AVATAR_IDS);
export type AvatarId = z.infer<typeof AvatarId>;

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
export const CreateRoomMessage = msg(
  "createRoom",
  z.object({ name: Name, avatar: AvatarId.optional() }),
);
export const JoinRoomMessage = msg(
  "joinRoom",
  z.object({ room: RoomCode, name: Name, avatar: AvatarId.optional() }),
);
/** Lobby only: change the sender's avatar. */
export const SetAvatarMessage = msg("setAvatar", z.object({ avatar: AvatarId }));
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
/** Host only, lobby only: seat a bot in the next free seat. */
export const AddBotMessage = msg("addBot", z.object({}));
/** Host only, lobby only: remove the bot in `seat`; later seats close up. */
export const RemoveBotMessage = msg("removeBot", z.object({ seat: Seat }));
export const GameActionMessage = msg("gameAction", z.object({ action: ClientActionSchema }));

/** A browser Web Push subscription (PushSubscription.toJSON()), size-limited. */
export const PushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1024),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});
export type PushSubscriptionJSON = z.infer<typeof PushSubscriptionSchema>;
/** Seated connections only (game-server "Push subscriptions"). `lang` picks the notification text. */
export const PushSubscribeMessage = msg(
  "pushSubscribe",
  z.object({ subscription: PushSubscriptionSchema, lang: z.string().min(1).max(8) }),
);
export const PushUnsubscribeMessage = msg(
  "pushUnsubscribe",
  z.object({ endpoint: z.string().min(1).max(1024) }),
);
/** Whether this connection's page is visible (game-server "Connection visibility"). */
export const VisibilityMessage = msg("visibility", z.object({ visible: z.boolean() }));

/** Host only: freeze a running game (game-pause). */
export const PauseGameMessage = msg("pauseGame", z.object({}));
/** Host only: continue a paused game. */
export const ResumeGameMessage = msg("resumeGame", z.object({}));
/** Host only: end a running or paused game now; most total VP wins (early-end). */
export const EndGameMessage = msg("endGame", z.object({}));
/** Max rooms per `lookupSeats`. */
export const MAX_LOOKUP_SEATS = 20;
/** Status of rooms this browser holds seat tokens for (saved-games). Binds no seat. */
export const LookupSeatsMessage = msg(
  "lookupSeats",
  z.object({
    seats: z
      .array(z.object({ room: RoomCode, token: z.string().min(1).max(128) }))
      .max(MAX_LOOKUP_SEATS),
  }),
);

/**
 * Host only, from the saved games list: end a running or paused game without taking the
 * seat (early-end). Answered with `seatsInfo` holding that one room.
 */
export const EndSavedGameMessage = msg(
  "endSavedGame",
  z.object({ room: RoomCode, token: z.string().min(1).max(128) }),
);

export const ClientMessage = z.discriminatedUnion("type", [
  HelloMessage,
  PingMessage,
  CreateRoomMessage,
  JoinRoomMessage,
  ResumeRoomMessage,
  LeaveRoomMessage,
  StartGameMessage,
  AddBotMessage,
  RemoveBotMessage,
  SetAvatarMessage,
  GameActionMessage,
  PushSubscribeMessage,
  PushUnsubscribeMessage,
  VisibilityMessage,
  PauseGameMessage,
  ResumeGameMessage,
  EndGameMessage,
  LookupSeatsMessage,
  EndSavedGameMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---- server -> client
export const WelcomeMessage = msg(
  "welcome",
  z.object({
    serverVersion: z.string(),
    protocolVersion: z.number().int(),
    /** VAPID public key (base64url) when the server sends Web Push, else null. */
    pushKey: z.string().nullable(),
  }),
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
  "not_a_bot",
  "bad_avatar",
  "avatar_taken",
  "bad_token",
  "no_seat",
  "already_in_room",
  "unavailable",
  "rate_limited",
  "game_paused",
  "not_paused",
  "not_playing",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ErrorMessage = msg("error", z.object({ code: ErrorCode, message: z.string() }));

export const RoomStatus = z.enum(["lobby", "playing", "paused", "ended"]);
export type RoomStatus = z.infer<typeof RoomStatus>;
export const SeatInfo = z.object({
  seat: Seat,
  name: z.string(),
  connected: z.boolean(),
  /** Bot seats are driven by the server and always report connected. */
  bot: z.boolean(),
  /** Catalog id; unique per room. */
  avatar: AvatarId,
});
export type SeatInfo = z.infer<typeof SeatInfo>;

/** `token` is present only on create and join (never on resume). */
export const RoomJoinedMessage = msg(
  "roomJoined",
  z.object({ room: z.string(), seat: Seat, token: z.string().optional() }),
);
export const RoomLeftMessage = msg("roomLeft", z.object({ room: z.string() }));
/** Outcome of a game the host ended early (early-end). Ties share the win. */
export const EarlyResult = z.object({
  reason: z.literal("host"),
  /** Server ms when the game was ended. */
  at: z.number(),
  winners: z.array(Seat).min(1),
  /** Per seat: total VP (public + hidden VP cards) and the hidden VP cards among it. */
  scores: z.array(
    z.object({
      seat: Seat,
      vp: z.number().int().nonnegative(),
      hiddenVp: z.number().int().nonnegative(),
    }),
  ),
});
export type EarlyResult = z.infer<typeof EarlyResult>;

export const RoomStateMessage = msg(
  "roomState",
  z.object({
    room: z.string(),
    status: RoomStatus,
    host: Seat,
    seats: z.array(SeatInfo),
    /** Server ms when the host paused; null unless paused. */
    pausedAt: z.number().nullable(),
    /** Set when the host ended the game early; null otherwise. */
    result: EarlyResult.nullable(),
  }),
);

/** One `seatsInfo` entry. `gone`: missing room or a token that matches no seat. */
export const SeatInfoEntry = z.union([
  z.object({ room: z.string(), status: z.literal("gone") }),
  z.object({
    room: z.string(),
    status: RoomStatus,
    /** The token's seat. */
    seat: Seat,
    host: Seat,
    /** Index = seat. */
    names: z.array(z.string()),
    /** Index = seat: true for bot seats. */
    bots: z.array(z.boolean()),
    /** Turn number, only when the server holds the game in memory. */
    turn: z.number().int().nonnegative().nullable(),
    pausedAt: z.number().nullable(),
    /** Server ms when the room expires. */
    expiresAt: z.number().nullable(),
    /** Server ms when the room was created. */
    createdAt: z.number(),
    /** Server ms when the game started; null in the lobby. */
    startedAt: z.number().nullable(),
    /** Server ms of the last game move or room change (pause, end); null if unknown. */
    lastActiveAt: z.number().nullable(),
  }),
]);
export type SeatInfoEntry = z.infer<typeof SeatInfoEntry>;
/** Answer to `lookupSeats`, in request order. */
export const SeatsInfoMessage = msg("seatsInfo", z.object({ rooms: z.array(SeatInfoEntry) }));
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
  SeatsInfoMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export type ClientMessageType = ClientMessage["type"];
export type ServerMessageType = ServerMessage["type"];
/** Payload type of a message type. */
export type PayloadOf<M extends { type: string; payload: unknown }, T extends M["type"]> = Extract<
  M,
  { type: T }
>["payload"];
