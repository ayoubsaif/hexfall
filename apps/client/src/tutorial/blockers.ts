// Why a game control is unavailable, in plain words (openspec tutorial-mode-and-rules-guide,
// specs/tutorial-mode "Rule helpers on game controls"; design decision 4). Availability always
// comes from the server's legal moves (`controlsOf`); this only explains a control that is off.
import type {
  LegalActions,
  PlayableDevCard,
  PlayerView,
  ResourceBundle,
  ResourceCounts,
} from "@hexfall/engine";
import { COSTS, RESOURCES } from "@hexfall/engine/geometry";
import { controlsOf } from "../game/status.ts";
import type { T } from "../i18n/index.ts";
import { resourceLabel } from "../i18n/labels.ts";
import type { BuildChoice } from "../store/ui.ts";
import type { Topic } from "./topics.ts";

/** Why a paid build is unavailable, as a key under play.actions.blocked (null: it is available). */
export function blockedReason(
  kind: BuildChoice,
  opts: { rolled: boolean; left: number | undefined; hand: ResourceCounts | undefined },
  cost: ResourceBundle,
): "rollFirst" | "pieces" | "cards" | BuildChoice | null {
  if (!opts.rolled) return "rollFirst";
  if (opts.left !== undefined && opts.left <= 0) return "pieces";
  if (opts.hand && RESOURCES.some((r) => (opts.hand?.[r] ?? 0) < (cost[r] ?? 0))) return "cards";
  return kind; // cards and pieces are fine, so no legal spot is left
}

export type BlockerKey =
  | "notYourTurn"
  | "rollFirst"
  | "cards"
  | "cardsToTrade"
  | "pieces"
  | "deckEmpty"
  | "boughtThisTurn"
  | "alreadyPlayed"
  | "finishStep"
  | "notNow"
  | "noSpot";

export interface Blocker {
  key: BlockerKey;
  /** `cards`: what is missing from the hand. */
  missing?: ResourceBundle;
  /** `noSpot`: which build found no legal spot. */
  build?: BuildChoice;
}

/** The part of `cost` the hand does not cover. */
export function missingCards(
  cost: ResourceBundle,
  hand: ResourceCounts | undefined,
): ResourceBundle {
  const out: ResourceBundle = {};
  for (const r of RESOURCES) {
    const short = (cost[r] ?? 0) - (hand?.[r] ?? 0);
    if (short > 0) out[r] = short;
  }
  return out;
}

const BUILD_PIECE = { road: "roads", settlement: "settlements", city: "cities" } as const;
const BUILD_COST = { road: COSTS.road, settlement: COSTS.settlement, city: COSTS.city } as const;
const PLAYS: ReadonlySet<Topic> = new Set(["knight", "roadBuilding", "yearOfPlenty", "monopoly"]);

/** Phases inside the active player's turn that must finish before building or trading. */
const STEPS: ReadonlySet<PlayerView["phase"]["kind"]> = new Set([
  "discard",
  "moveRobber",
  "roadBuilding",
]);

/**
 * Why the control for `topic` is off for the viewer, or null when it is available (or the topic
 * has no control that can be off: roll, robber, discard, Victory Point cards).
 */
export function blockerFor(
  topic: Topic,
  view: PlayerView | null,
  legal: LegalActions | null,
): Blocker | null {
  if (!view || !legal || view.winner !== null) return null;
  const c = controlsOf(view, legal);
  const viewer = view.viewer;
  const own = viewer === null ? undefined : view.players[viewer];
  const window = view.phase.kind === "specialBuild";
  const mine =
    viewer !== null &&
    (view.phase.kind === "specialBuild" ? view.phase.current : view.turn.seat) === viewer;

  if (PLAYS.has(topic)) {
    const card = topic as PlayableDevCard;
    if (c.devCards.includes(card)) return null;
    if (!mine) return { key: "notYourTurn" };
    if (view.turn.devPlayed) return { key: "alreadyPlayed" };
    const held = (own?.devCards ?? []).filter((d) => d === card).length;
    const fresh = (own?.boughtThisTurn ?? []).filter((d) => d === card).length;
    if (held > 0 && fresh >= held) return { key: "boughtThisTurn" };
    if (STEPS.has(view.phase.kind)) return { key: "finishStep" };
    return { key: "notNow" };
  }

  const available: Partial<Record<Topic, boolean>> = {
    road: c.buildRoad,
    settlement: c.buildSettlement,
    city: c.buildCity,
    devBuy: c.buyDevCard,
    endTurn: c.endTurn,
    maritime: c.maritime,
    trade: c.proposeTrade,
  };
  const on = available[topic];
  if (on === undefined || on) return null;
  if (!mine) return { key: "notYourTurn" };
  if (STEPS.has(view.phase.kind)) return { key: "finishStep" };
  if (view.phase.kind !== "turn" && !window) return { key: "notNow" };
  // No roll in a building window; trading and ending the turn are not allowed there.
  if (window && (topic === "maritime" || topic === "trade" || topic === "endTurn")) {
    return { key: "notNow" };
  }
  const rolled = window || view.turn.rolled;
  if (!rolled) return { key: "rollFirst" };

  switch (topic) {
    case "road":
    case "settlement":
    case "city": {
      const why = blockedReason(
        topic,
        { rolled, left: own?.pieces[BUILD_PIECE[topic]], hand: own?.resources },
        BUILD_COST[topic],
      );
      if (why === "pieces") return { key: "pieces" };
      if (why === "cards")
        return { key: "cards", missing: missingCards(BUILD_COST[topic], own?.resources) };
      if (why === "rollFirst") return { key: "rollFirst" };
      // Cards and pieces are fine, so the engine listed no legal spot.
      return { key: "noSpot", build: topic };
    }
    case "devBuy": {
      if (view.devDeckCount <= 0) return { key: "deckEmpty" };
      const missing = missingCards(COSTS.devCard, own?.resources);
      if (Object.keys(missing).length > 0) return { key: "cards", missing };
      return { key: "notNow" };
    }
    case "maritime":
    case "trade":
      return { key: "cardsToTrade" };
    default:
      return { key: "notNow" };
  }
}

/** "1 brick, 1 lumber" for a bundle. */
export function bundleText(b: ResourceBundle, t: T): string {
  return RESOURCES.filter((r) => (b[r] ?? 0) > 0)
    .map((r) => t("play.actions.costItem", { count: b[r] ?? 0, resource: resourceLabel(t, r) }))
    .join(", ");
}

/** The blocker as one translated sentence. */
export function blockerText(b: Blocker, t: T): string {
  switch (b.key) {
    case "cards":
      return t("tutorial.blocker.cards", { cards: bundleText(b.missing ?? {}, t) });
    case "noSpot":
      return t(`tutorial.blocker.noSpot.${b.build ?? "road"}`);
    default:
      return t(`tutorial.blocker.${b.key}`);
  }
}
