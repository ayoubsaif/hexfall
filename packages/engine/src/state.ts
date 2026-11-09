// Game state, actions, events and views (specs/rules-engine, design.md decision 2).
// Everything here is plain JSON data. Handlers mutate a cloned draft (decision 1).
import type { Board, Resource } from "./board.ts";
import type { RngSeed, RngState } from "./rng.ts";
import type { RuleErrorCode } from "./rules/errors.ts";
import type { EdgeId, HexId, VertexId } from "./topology.ts";

/** Seat index 0..playerCount-1. Clockwise = increasing seat index. */
export type Seat = number;

export type ResourceCounts = Record<Resource, number>;
/** Resource amounts with omitted keys meaning 0. */
export type ResourceBundle = Partial<Record<Resource, number>>;

export type DevCard = "knight" | "roadBuilding" | "yearOfPlenty" | "monopoly" | "victoryPoint";
/** Cards that count toward the one-card-per-turn limit. */
export type PlayableDevCard = Exclude<DevCard, "victoryPoint">;

export type BoardMode = "beginner" | "variable";

export type PlayerCount = 3 | 4 | 5 | 6;

export interface GameConfig {
  readonly seed: RngSeed;
  /** 3–4 play the standard board; 5–6 the large board with the Special Building Phase. */
  readonly playerCount: PlayerCount;
  /** 5–6 players only support "variable". */
  readonly mode: BoardMode;
  /** VP needed to win, 8–15. Default 10. */
  readonly victoryTarget?: number | undefined;
  /** If given, setup starts with this seat; otherwise players roll for it. */
  readonly startingPlayer?: Seat;
}

export interface Building {
  owner: Seat;
  kind: "settlement" | "city";
}

export interface Pieces {
  roads: number;
  settlements: number;
  cities: number;
}

export interface PlayerState {
  resources: ResourceCounts;
  /** Development cards in hand (unplayed, unrevealed), in purchase order. */
  devCards: DevCard[];
  /** Cards bought during the current turn (a sub-multiset of devCards). */
  boughtThisTurn: DevCard[];
  /** Played Knights (face up). */
  knights: number;
  /** Revealed VP cards. */
  revealedVp: number;
  /** Pieces left in the player's supply. */
  pieces: Pieces;
}

export type Phase =
  /** Players roll for the starting player. `rolls[seat]` is null until that contender rolls. */
  | { kind: "rollForOrder"; contenders: Seat[]; rolls: (number | null)[] }
  /**
   * Initial placement. `order` is the full snake (2 × playerCount entries); the
   * placing seat is order[index]. `lastSettlement` is the settlement the current
   * road must touch.
   */
  | {
      kind: "setup";
      order: Seat[];
      index: number;
      step: "settlement" | "road";
      lastSettlement: VertexId | null;
    }
  /** Normal turn: roll (if not yet), trade, build, play cards. */
  | { kind: "turn" }
  /** After a rolled 7: `owed[seat]` cards each player still has to discard. */
  | { kind: "discard"; owed: number[] }
  /** The active player must move the robber (after a 7 or a Knight). */
  | { kind: "moveRobber"; source: "seven" | "knight" }
  /** Road Building: `remaining` free roads still to place. */
  | { kind: "roadBuilding"; remaining: number }
  /**
   * Special Building Phase (5–6 players): after `afterTurnOf` ended their turn,
   * `current` may build and buy, then pass; `queue` holds the seats still to come
   * (clockwise). turn.seat stays `afterTurnOf` until the next turn starts.
   */
  | { kind: "specialBuild"; current: Seat; queue: Seat[]; afterTurnOf: Seat }
  | { kind: "ended" };

export type PhaseKind = Phase["kind"];

export interface TurnState {
  /** Active seat (also the placing seat during setup and the roller in rollForOrder). */
  seat: Seat;
  /** 0 during roll-for-order and setup, 1 for the first normal turn. */
  number: number;
  rolled: boolean;
  devPlayed: boolean;
  dice: [number, number] | null;
}

export interface TradeOffer {
  id: number;
  from: Seat;
  /** Seats that may accept. */
  to: Seat[];
  /** What `from` gives. */
  give: ResourceBundle;
  /** What `from` gets. */
  get: ResourceBundle;
  rejectedBy: Seat[];
}

export interface GameState {
  rng: RngState;
  playerCount: number;
  mode: BoardMode;
  /** VP needed to win (8–15). Read through victoryTargetOf (states stored before it existed lack it). */
  victoryTarget: number;
  /** Cards of each resource the game started with in the bank (19, or 24 with 5–6 players). */
  bankPerResource: number;
  board: Board;
  robber: HexId;
  /** Index = VertexId of the board's topology (54 standard, 80 large). */
  vertices: (Building | null)[];
  /** Index = EdgeId of the board's topology (72 standard, 109 large): road owner. */
  edges: (Seat | null)[];
  bank: ResourceCounts;
  /** Face-down deck; the top card is the last element. */
  devDeck: DevCard[];
  /** Progress cards played (removed from the game). */
  removedCards: DevCard[];
  players: PlayerState[];
  phase: Phase;
  turn: TurnState;
  longestRoad: Seat | null;
  largestArmy: Seat | null;
  offers: TradeOffer[];
  nextOfferId: number;
  winner: Seat | null;
  log: GameEvent[];
}

// ---- Actions

export type Action =
  | { type: "rollForOrder"; seat: Seat }
  | { type: "placeSettlement"; seat: Seat; vertex: VertexId }
  | { type: "placeRoad"; seat: Seat; edge: EdgeId }
  | { type: "rollDice"; seat: Seat }
  | { type: "discard"; seat: Seat; cards: ResourceBundle }
  | { type: "moveRobber"; seat: Seat; hex: HexId; victim: Seat | null }
  /** A paid road, or a free one during Road Building. */
  | { type: "buildRoad"; seat: Seat; edge: EdgeId }
  | { type: "buildSettlement"; seat: Seat; vertex: VertexId }
  | { type: "buildCity"; seat: Seat; vertex: VertexId }
  | { type: "buyDevCard"; seat: Seat }
  | { type: "playKnight"; seat: Seat }
  | { type: "playRoadBuilding"; seat: Seat }
  /** Exactly min(2, cards in bank) resources. */
  | { type: "playYearOfPlenty"; seat: Seat; resources: Resource[] }
  | { type: "playMonopoly"; seat: Seat; resource: Resource }
  | { type: "revealVictoryPoints"; seat: Seat }
  /** From the active player: `to` = opponents who may accept. From anyone else: `to` must be [active seat]. */
  | { type: "proposeTrade"; seat: Seat; give: ResourceBundle; get: ResourceBundle; to: Seat[] }
  | { type: "acceptTrade"; seat: Seat; offerId: number }
  | { type: "rejectTrade"; seat: Seat; offerId: number }
  | { type: "cancelTrade"; seat: Seat; offerId: number }
  /** Gives `count × rate` of `give` for `count` of `get`. */
  | { type: "maritimeTrade"; seat: Seat; give: Resource; get: Resource; count: number }
  | { type: "endTurn"; seat: Seat }
  /** Closes the seat's Special Building Phase window. */
  | { type: "passSpecialBuild"; seat: Seat }
  /**
   * System-only (turn timer): resolves whatever the game is waiting for, with the state RNG.
   * Never sent by clients and never listed in legal moves.
   */
  | { type: "timeout" };

export type ActionType = Action["type"];
export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>;

// ---- Events (the log)

export type GameEvent =
  | { type: "gameCreated"; playerCount: number; mode: BoardMode; victoryTarget?: number }
  | { type: "orderRolled"; seat: Seat; dice: [number, number] }
  | { type: "orderTied"; seats: Seat[] }
  /** The turn timer ran out; the events that follow are the moves made for `seats`. */
  | { type: "timedOut"; phase: PhaseKind; seats: Seat[] }
  | { type: "startingPlayer"; seat: Seat }
  | {
      type: "built";
      seat: Seat;
      piece: "road" | "settlement" | "city";
      /** EdgeId for roads, VertexId otherwise. */
      at: number;
      /** Setup placement or Road Building. */
      free: boolean;
    }
  | { type: "startingResources"; seat: Seat; resources: ResourceBundle }
  | { type: "diceRolled"; seat: Seat; dice: [number, number]; total: number }
  | { type: "produced"; seat: Seat; resources: ResourceBundle }
  /** Bank shortage: nobody (or only the single owed player, partially) got this resource. */
  | { type: "shortage"; resource: Resource }
  | { type: "discarded"; seat: Seat; resources: ResourceBundle }
  | { type: "robberMoved"; seat: Seat; hex: HexId }
  /** `resource` is null when the victim had no cards. Redacted in views (decision 8). */
  | { type: "stole"; thief: Seat; victim: Seat; resource: Resource | null }
  /** `card` is redacted to null for everyone but the buyer in views. */
  | { type: "devCardBought"; seat: Seat; card: DevCard | null }
  | { type: "devCardPlayed"; seat: Seat; card: PlayableDevCard }
  | { type: "yearOfPlenty"; seat: Seat; resources: Resource[] }
  /** `taken[seat]` = cards taken from each seat. */
  | { type: "monopoly"; seat: Seat; resource: Resource; taken: number[] }
  | { type: "tradeOffered"; offer: TradeOffer }
  | {
      type: "tradeAccepted";
      offerId: number;
      from: Seat;
      by: Seat;
      give: ResourceBundle;
      get: ResourceBundle;
    }
  | { type: "tradeRejected"; offerId: number; seat: Seat }
  | { type: "tradeCancelled"; offerId: number }
  | {
      type: "maritimeTrade";
      seat: Seat;
      give: Resource;
      giveCount: number;
      get: Resource;
      getCount: number;
    }
  | { type: "longestRoad"; from: Seat | null; to: Seat | null; length: number }
  | { type: "largestArmy"; from: Seat | null; to: Seat; knights: number }
  | { type: "vpRevealed"; seat: Seat; count: number }
  | { type: "turnEnded"; seat: Seat }
  /** A Special Building Phase window opened for `seat`. */
  | { type: "specialBuildOpened"; seat: Seat }
  /** `seat` closed their window (by passing, or by the turn timer). */
  | { type: "specialBuildPassed"; seat: Seat }
  | { type: "turnStarted"; seat: Seat; number: number }
  | { type: "gameWon"; seat: Seat; vp: number };

// ---- Results

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; code: RuleErrorCode; message: string };

// ---- Legal moves (decision 4)

export interface RobberOption {
  hex: HexId;
  /** Opponents with a building on the hex; empty means victim must be null. */
  victims: Seat[];
}

export interface LegalActions {
  rollForOrder: boolean;
  placeSettlement: VertexId[];
  placeRoad: EdgeId[];
  rollDice: boolean;
  /** Cards this seat must discard now (0 if none). */
  discard: number;
  moveRobber: RobberOption[];
  /** Paid roads, or free roads during Road Building. */
  buildRoad: EdgeId[];
  buildSettlement: VertexId[];
  buildCity: VertexId[];
  buyDevCard: boolean;
  playDevCard: PlayableDevCard[];
  revealVictoryPoints: boolean;
  proposeTrade: boolean;
  acceptTrade: number[];
  rejectTrade: number[];
  cancelTrade: number[];
  /** Bank rate per resource when maritime trade is allowed now, else null. */
  maritime: ResourceCounts | null;
  endTurn: boolean;
  /** True when it is this seat's Special Building Phase window. */
  passSpecialBuild: boolean;
}

// ---- Redacted view (decision 8)

export interface PlayerSummary {
  seat: Seat;
  resourceCount: number;
  devCardCount: number;
  knights: number;
  revealedVp: number;
  publicVp: number;
  pieces: Pieces;
  /** Only for the viewer's own seat (and everyone once the game has ended). */
  resources?: ResourceCounts;
  devCards?: DevCard[];
  boughtThisTurn?: DevCard[];
  /** Hidden VP cards: own seat only, or everyone once the game has ended. */
  hiddenVp?: number;
}

export interface PlayerView {
  viewer: Seat | null;
  playerCount: number;
  mode: BoardMode;
  victoryTarget: number;
  board: Board;
  robber: HexId;
  vertices: (Building | null)[];
  edges: (Seat | null)[];
  bank: ResourceCounts;
  devDeckCount: number;
  players: PlayerSummary[];
  phase: Phase;
  turn: TurnState;
  longestRoad: Seat | null;
  largestArmy: Seat | null;
  offers: TradeOffer[];
  winner: Seat | null;
  log: GameEvent[];
}
