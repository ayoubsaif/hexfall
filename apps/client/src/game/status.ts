// What the game is waiting for, and which HUD controls are enabled (specs/game-hud,
// "Turn status and controls"). Enablement comes only from the server's legal moves.
import type { GameEvent, LegalActions, PlayableDevCard, PlayerView, Seat } from "@hexfall/engine";
import type { T } from "../i18n/index.ts";
import type { Names } from "./describe.ts";

/** One line of status, plus whether the viewer is the one being waited for. */
export interface Status {
  text: string;
  /** The viewer must act now. */
  yourMove: boolean;
}

const list = (seats: Seat[], n: Names) => seats.map(n).join(", ");

export function statusOf(view: PlayerView, names: Names, t: T): Status {
  const viewer = view.viewer;
  const active = view.turn.seat;
  const mine = viewer !== null && viewer === active;
  const p = view.phase;
  switch (p.kind) {
    case "rollForOrder": {
      const waiting = p.contenders.filter((s) => p.rolls[s] === null || p.rolls[s] === undefined);
      if (viewer !== null && waiting.includes(viewer)) {
        return { text: t("game.status.rollForOrder"), yourMove: true };
      }
      return {
        text: t("game.status.rollForOrderWaiting", { names: list(waiting, names) }),
        yourMove: false,
      };
    }
    case "setup": {
      const seat = p.order[p.index] ?? active;
      const round = p.index < p.order.length / 2 ? 1 : 2;
      if (viewer === seat) {
        const key =
          p.step === "settlement"
            ? round === 1
              ? "game.status.placeFirstSettlement"
              : "game.status.placeSecondSettlement"
            : round === 1
              ? "game.status.placeFirstRoad"
              : "game.status.placeSecondRoad";
        return { text: t(key), yourMove: true };
      }
      return {
        text: t(
          p.step === "settlement" ? "game.status.placingSettlement" : "game.status.placingRoad",
          { name: names(seat) },
        ),
        yourMove: false,
      };
    }
    case "turn":
      if (!view.turn.rolled) {
        return mine
          ? { text: t("game.status.rollDice"), yourMove: true }
          : { text: t("game.status.aboutToRoll", { name: names(active) }), yourMove: false };
      }
      return mine
        ? { text: t("game.status.yourTurn"), yourMove: true }
        : { text: t("game.status.theirTurn", { name: names(active) }), yourMove: false };
    case "discard": {
      const owers = p.owed.flatMap((n, s) => (n > 0 ? [s] : []));
      const own = viewer === null ? 0 : (p.owed[viewer] ?? 0);
      if (own > 0) {
        return { text: t("game.status.discard", { count: own }), yourMove: true };
      }
      return {
        text: t("game.status.discardWaiting", { names: list(owers, names) }),
        yourMove: false,
      };
    }
    case "moveRobber":
      return mine
        ? { text: t("game.status.moveRobber"), yourMove: true }
        : { text: t("game.status.movingRobber", { name: names(active) }), yourMove: false };
    case "roadBuilding": {
      const count = p.remaining;
      return mine
        ? { text: t("game.status.placeFreeRoad", { count }), yourMove: true }
        : {
            text: t("game.status.placingFreeRoads", { name: names(active), count }),
            yourMove: false,
          };
    }
    case "specialBuild":
      return viewer === p.current
        ? { text: t("game.status.specialBuildYou"), yourMove: true }
        : {
            text: t("game.status.specialBuildTheirs", { name: names(p.current) }),
            yourMove: false,
          };
    case "ended":
      return {
        text:
          view.winner === null
            ? t("game.status.gameOver")
            : t("game.status.won", { name: names(view.winner) }),
        yourMove: false,
      };
  }
}

/** Phases after setup in which the active player may see the build, buy and trade buttons. */
const BUILD_PHASES: ReadonlySet<PlayerView["phase"]["kind"]> = new Set([
  "turn",
  "discard",
  "moveRobber",
  "roadBuilding",
]);

/**
 * Whether the floating build/buy/trade buttons and End turn are shown at all (specs/game-hud
 * "Turn status and controls"; design decision 6): only to the active player after setup, never
 * during roll for order, setup, the game's end, or another player's turn. Enabling is separate
 * (`controlsOf`).
 */
export function showBuildControls(view: PlayerView | null, seat: Seat | null): boolean {
  if (!view || seat === null || view.winner !== null) return false;
  // Special Building Phase: only the seat whose building window is open.
  if (view.phase.kind === "specialBuild") return view.phase.current === seat;
  return BUILD_PHASES.has(view.phase.kind) && view.turn.seat === seat;
}

export interface Controls {
  rollForOrder: boolean;
  rollDice: boolean;
  endTurn: boolean;
  buyDevCard: boolean;
  buildRoad: boolean;
  buildSettlement: boolean;
  buildCity: boolean;
  maritime: boolean;
  /** Making a player trade offer (own turn or, for others, to the active player). */
  proposeTrade: boolean;
  devCards: PlayableDevCard[];
  revealVictoryPoints: boolean;
  /** Closing the viewer's Special Building Phase window ("Done building"). */
  passSpecialBuild: boolean;
}

const NONE: Controls = {
  rollForOrder: false,
  rollDice: false,
  endTurn: false,
  buyDevCard: false,
  buildRoad: false,
  buildSettlement: false,
  buildCity: false,
  maritime: false,
  proposeTrade: false,
  devCards: [],
  revealVictoryPoints: false,
  passSpecialBuild: false,
};

/** Controls the viewer may use now. Everything is off while an action is in flight. */
export function controlsOf(
  view: PlayerView | null,
  legal: LegalActions | null,
  inFlight = false,
): Controls {
  if (!view || !legal || inFlight || view.winner !== null) return NONE;
  // Paid builds only in the main turn or the viewer's building window; Road Building's free
  // roads are picked on the board.
  const main =
    view.phase.kind === "turn" ||
    (view.phase.kind === "specialBuild" && view.phase.current === view.viewer);
  return {
    rollForOrder: legal.rollForOrder,
    rollDice: legal.rollDice,
    endTurn: legal.endTurn,
    buyDevCard: legal.buyDevCard,
    buildRoad: main && legal.buildRoad.length > 0,
    buildSettlement: main && legal.buildSettlement.length > 0,
    buildCity: main && legal.buildCity.length > 0,
    maritime: legal.maritime !== null,
    proposeTrade: legal.proposeTrade,
    devCards: [...legal.playDevCard],
    revealVictoryPoints: legal.revealVictoryPoints,
    passSpecialBuild: legal.passSpecialBuild,
  };
}

export interface DiceRoll {
  dice: [number, number];
  seat: Seat;
  /** Log index of the roll (changes on every roll, to restart the reveal animation). */
  index: number;
}

/** Latest roll of the current turn (including rolls for order), or null. */
export function latestRoll(log: readonly GameEvent[]): DiceRoll | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!;
    if (e.type === "turnStarted") return null;
    if (e.type === "diceRolled" || e.type === "orderRolled") {
      return { dice: e.dice, seat: e.seat, index: i };
    }
  }
  return null;
}

/** Latest roll anywhere in the log (any turn), or null: what the resting dice show. */
export function previousRoll(log: readonly GameEvent[]): DiceRoll | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!;
    if (e.type === "diceRolled" || e.type === "orderRolled") {
      return { dice: e.dice, seat: e.seat, index: i };
    }
  }
  return null;
}

/** Sum of a roll's dice, or null. */
export function diceTotal(roll: DiceRoll | null): number | null {
  return roll ? roll.dice[0] + roll.dice[1] : null;
}
