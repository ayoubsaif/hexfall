// Game creation, the action reducer, turn end, victory and legal moves
// (specs/rules-engine, design.md decisions 1-6).
import { beginnerBoard, createVariableBoard } from "./board.ts";
import { createRng, shuffle } from "./rng.ts";
import type {
  Action,
  ApplyResult,
  DevCard,
  GameConfig,
  GameState,
  LegalActions,
  PlayerState,
  Seat,
} from "./state.ts";
import { TOPOLOGY } from "./topology.ts";
import {
  BANK_PER_RESOURCE,
  WIN_VP,
  emit,
  emptyCounts,
  inBuildWindow,
  publicVp,
} from "./rules/common.ts";
import * as dev from "./rules/devCards.ts";
import { RuleError, check } from "./rules/errors.ts";
import * as placement from "./rules/placement.ts";
import * as production from "./rules/production.ts";
import * as robber from "./rules/robber.ts";
import * as setup from "./rules/setup.ts";
import { resolveTimeout } from "./rules/timeout.ts";
import * as trade from "./rules/trade.ts";
import { endTurn } from "./rules/turn.ts";

/** Fixed pre-shuffle deck order (replay contract, design.md decision 5). */
export const DEV_DECK: readonly DevCard[] = Object.freeze([
  ...Array<DevCard>(14).fill("knight"),
  ...Array<DevCard>(2).fill("roadBuilding"),
  ...Array<DevCard>(2).fill("yearOfPlenty"),
  ...Array<DevCard>(2).fill("monopoly"),
  ...Array<DevCard>(5).fill("victoryPoint"),
]);

function newPlayer(): PlayerState {
  return {
    resources: emptyCounts(),
    devCards: [],
    boughtThisTurn: [],
    knights: 0,
    revealedVp: 0,
    pieces: { roads: 15, settlements: 5, cities: 4 },
  };
}

/** Creates a game (AGENTS.md §4). RNG draws: variable board first, then the deck shuffle. */
export function createGame(config: GameConfig): GameState {
  const { seed, playerCount, mode, startingPlayer } = config;
  if (playerCount !== 3 && playerCount !== 4) {
    throw new RuleError("invalid_config", `playerCount must be 3 or 4, got ${String(playerCount)}`);
  }
  if (mode !== "beginner" && mode !== "variable") {
    throw new RuleError("invalid_config", `unknown mode ${String(mode)}`);
  }
  if (
    startingPlayer !== undefined &&
    (!Number.isInteger(startingPlayer) || startingPlayer < 0 || startingPlayer >= playerCount)
  ) {
    throw new RuleError("invalid_config", `startingPlayer out of range: ${String(startingPlayer)}`);
  }
  let rng = createRng(seed);
  let board = beginnerBoard();
  if (mode === "variable") [board, rng] = createVariableBoard(rng);
  const [deck, rngAfterDeck] = shuffle(rng, DEV_DECK);
  const bank = emptyCounts();
  for (const r of Object.keys(bank) as (keyof typeof bank)[]) bank[r] = BANK_PER_RESOURCE;

  const s: GameState = {
    rng: rngAfterDeck,
    playerCount,
    mode,
    board,
    robber: board.robber,
    vertices: TOPOLOGY.vertices.map(() => null),
    edges: TOPOLOGY.edges.map(() => null),
    bank,
    devDeck: deck,
    removedCards: [],
    players: Array.from({ length: playerCount }, newPlayer),
    phase: {
      kind: "rollForOrder",
      contenders: Array.from({ length: playerCount }, (_, i) => i),
      rolls: Array.from({ length: playerCount }, () => null),
    },
    turn: { seat: 0, number: 0, rolled: false, devPlayed: false, dice: null },
    longestRoad: null,
    largestArmy: null,
    offers: [],
    nextOfferId: 1,
    winner: null,
    log: [],
  };
  emit(s, { type: "gameCreated", playerCount, mode });
  if (startingPlayer !== undefined) setup.beginSetup(s, startingPlayer);
  return s;
}

/**
 * Ends the game if the active player has 10+ public VP (AGENTS.md §12). Runs
 * after every action, so a win reached on another player's turn takes effect
 * when the winner's own turn starts.
 */
function checkVictory(s: GameState): void {
  const k = s.phase.kind;
  if (k === "rollForOrder" || k === "setup" || k === "ended") return;
  const seat = s.turn.seat;
  const vp = publicVp(s, seat);
  if (vp < WIN_VP) return;
  s.phase = { kind: "ended" };
  s.winner = seat;
  s.offers = [];
  emit(s, { type: "gameWon", seat, vp });
}

function dispatch(s: GameState, a: Action): void {
  switch (a.type) {
    case "rollForOrder":
      return setup.rollForOrder(s, a);
    case "placeSettlement":
      return setup.placeSettlement(s, a);
    case "placeRoad":
      return setup.placeRoad(s, a);
    case "rollDice":
      return production.rollDice(s, a);
    case "discard":
      return robber.discard(s, a);
    case "moveRobber":
      return robber.moveRobber(s, a);
    case "buildRoad":
      return s.phase.kind === "roadBuilding" ? dev.placeFreeRoad(s, a) : placement.buildRoad(s, a);
    case "buildSettlement":
      return placement.buildSettlement(s, a);
    case "buildCity":
      return placement.buildCity(s, a);
    case "buyDevCard":
      return dev.buyDevCard(s, a);
    case "playKnight":
      return dev.playKnight(s, a);
    case "playRoadBuilding":
      return dev.playRoadBuilding(s, a);
    case "playYearOfPlenty":
      return dev.playYearOfPlenty(s, a);
    case "playMonopoly":
      return dev.playMonopoly(s, a);
    case "revealVictoryPoints":
      return dev.revealVictoryPoints(s, a);
    case "proposeTrade":
      return trade.proposeTrade(s, a);
    case "acceptTrade":
      return trade.acceptTrade(s, a);
    case "rejectTrade":
      return trade.rejectTrade(s, a);
    case "cancelTrade":
      return trade.cancelTrade(s, a);
    case "maritimeTrade":
      return trade.maritimeTrade(s, a);
    case "endTurn":
      return endTurn(s, a.seat);
    case "timeout":
      return resolveTimeout(s);
    default: {
      const never: never = a;
      throw new RuleError("invalid_action", `unknown action ${JSON.stringify(never)}`);
    }
  }
}

function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

/**
 * Applies one action. Never mutates `state`. Returns the next state and the
 * events this action appended, or a rule error (design.md decisions 1 and 3).
 */
export function applyAction(state: GameState, action: Action): ApplyResult {
  try {
    check(
      action !== null && typeof action === "object" && typeof action.type === "string",
      "invalid_action",
      "action must be an object with a type",
    );
    check(state.phase.kind !== "ended", "game_over", "the game has ended");
    // `timeout` is system-only and carries no seat (turn timer): dispatched before the seat check.
    if (action.type !== "timeout") {
      check(
        Number.isInteger(action.seat) && action.seat >= 0 && action.seat < state.playerCount,
        "invalid_action",
        `bad seat ${String(action.seat)}`,
      );
    }
    const s = cloneState(state);
    const before = s.log.length;
    dispatch(s, action);
    checkVictory(s);
    return { ok: true, state: s, events: s.log.slice(before) };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}

function noActions(): LegalActions {
  return {
    rollForOrder: false,
    placeSettlement: [],
    placeRoad: [],
    rollDice: false,
    discard: 0,
    moveRobber: [],
    buildRoad: [],
    buildSettlement: [],
    buildCity: [],
    buyDevCard: false,
    playDevCard: [],
    revealVictoryPoints: false,
    proposeTrade: false,
    acceptTrade: [],
    rejectTrade: [],
    cancelTrade: [],
    maritime: null,
    endTurn: false,
  };
}

/** Everything `seat` may do right now (AGENTS.md §13.1). Every listed move is accepted. */
export function legalActions(s: GameState, seat: Seat): LegalActions {
  const out = noActions();
  if (s.phase.kind === "ended" || !Number.isInteger(seat) || seat < 0 || seat >= s.playerCount) {
    return out;
  }
  const offers = trade.tradeOptions(s, seat);
  return {
    rollForOrder: setup.canRollForOrder(s, seat),
    placeSettlement: setup.legalSetupSettlements(s, seat),
    placeRoad: setup.legalSetupRoads(s, seat),
    rollDice: production.canRollDice(s, seat),
    discard: robber.discardOwed(s, seat),
    moveRobber: robber.robberOptions(s, seat),
    buildRoad:
      s.phase.kind === "roadBuilding"
        ? dev.roadBuildingRoads(s, seat)
        : placement.buildableRoads(s, seat),
    buildSettlement: placement.buildableSettlements(s, seat),
    buildCity: placement.buildableCities(s, seat),
    buyDevCard: dev.canBuyDevCard(s, seat),
    playDevCard: dev.playableDevCards(s, seat),
    revealVictoryPoints: dev.canRevealVictoryPoints(s, seat),
    proposeTrade: trade.canProposeTrade(s, seat),
    acceptTrade: offers.accept,
    rejectTrade: offers.reject,
    cancelTrade: offers.cancel,
    maritime: inBuildWindow(s, seat) ? trade.maritimeRates(s, seat) : null,
    endTurn: inBuildWindow(s, seat),
  };
}
