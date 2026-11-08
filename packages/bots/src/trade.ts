// Offer judge: should a bot accept a domestic trade (specs/bots, "Bots trade with a lone human")?
// Pure and RNG-free: the same view, offer and level always give the same answer.
import {
  COSTS,
  RESOURCES,
  type PlayerView,
  type ResourceBundle,
  type ResourceCounts,
  type Seat,
  type TradeOffer,
} from "@hexfall/engine";
import type { BotLevel } from "./level.ts";

type Target = "city" | "settlement" | "devCard" | "road";

const WEIGHT: Readonly<Record<Target, number>> = { city: 4, settlement: 4, devCard: 2, road: 1 };

/** How a level weighs a hand, and who it refuses to help. */
interface Rule {
  /** Share of each other build's progress counted next to the best one. */
  side: number;
  /** Worth of one card in hand (spare cards can be traded at the bank later). */
  card: number;
  /** How much the worth must rise before the bot says yes (0 = ties are accepted). */
  margin: number;
}
/** Hard: only progress towards the best build counts, and only surplus is given (judgeOffer). */
const HARD: Rule = { side: 0, card: 0.01, margin: 0.05 };
/** Normal: other builds and generous offers count too. */
const NORMAL: Rule = { side: 0.25, card: 0.06, margin: 0.05 };
/** Easy: any offer that leaves the hand no worse, spare cards counting clearly. */
const EASY: Rule = { side: 0.25, card: 0.25, margin: 0 };
/** Proposers at or above this public VP are never helped (Easy has no limit). */
const LEADER_VP: Readonly<Record<BotLevel, number>> = {
  easy: Infinity,
  normal: 9,
  hard: 8,
};
/** Each level accepts what the stricter ones accept, plus its own rule. */
const RULES: Readonly<Record<BotLevel, readonly Rule[]>> = {
  hard: [HARD],
  normal: [HARD, NORMAL],
  easy: [HARD, NORMAL, EASY],
};

/** Things the bot could still build, given its pieces and the deck. */
function targets(view: PlayerView, seat: Seat): Target[] {
  const me = view.players[seat]!;
  const out: Target[] = [];
  const hasSettlement = view.vertices.some((b) => b?.owner === seat && b.kind === "settlement");
  if (me.pieces.cities > 0 && hasSettlement) out.push("city");
  if (me.pieces.settlements > 0) out.push("settlement");
  if (view.devDeckCount > 0) out.push("devCard");
  if (me.pieces.roads > 0) out.push("road");
  return out;
}

/** Cards still missing for `t`. */
function gap(t: Target, hand: ResourceCounts): number {
  const cost: ResourceBundle = COSTS[t];
  return RESOURCES.reduce((n, r) => n + Math.max(0, (cost[r] ?? 0) - hand[r]), 0);
}

/** Most of `r` any of `ts` costs (the rest of a pile is surplus). */
function need(ts: readonly Target[], r: (typeof RESOURCES)[number]): number {
  return Math.max(0, ...ts.map((t) => (COSTS[t] as ResourceBundle)[r] ?? 0));
}

/**
 * How good a hand is under `rule`: progress towards the best build, a share of the progress
 * towards every other build (so a card that helps a second plan still counts), and a little
 * per card (so two cards for one is worth more than one for one).
 */
function score(rule: Rule, ts: readonly Target[], hand: ResourceCounts): number {
  const values = ts.map((t) => WEIGHT[t] / (1 + gap(t, hand)));
  const top = Math.max(0, ...values);
  const side = values.reduce((n, v) => n + v, 0) - top;
  const cards = RESOURCES.reduce((n, r) => n + hand[r], 0);
  return top + rule.side * side + rule.card * cards;
}

/** The bot's hand after the trade: it receives `offer.give` and pays `offer.get`. */
function after(hand: ResourceCounts, offer: TradeOffer): ResourceCounts | null {
  const out = { ...hand };
  for (const r of RESOURCES) {
    out[r] += (offer.give[r] ?? 0) - (offer.get[r] ?? 0);
    if (out[r] < 0) return null;
  }
  return out;
}

/** Whether the bot in `seat`, playing at `level`, should accept `offer` (it is a recipient). */
export function judgeOffer(
  view: PlayerView,
  seat: Seat,
  offer: TradeOffer,
  level: BotLevel = "normal",
): boolean {
  const hand = view.players[seat]?.resources;
  if (!hand) return false;
  if ((view.players[offer.from]?.publicVp ?? 0) >= LEADER_VP[level]) return false;
  const next = after(hand, offer);
  if (!next) return false;
  const ts = targets(view, seat);
  // Never give up a card needed for something already affordable.
  if (ts.some((t) => gap(t, hand) === 0 && gap(t, next) > 0)) return false;
  // Hard gives away only true surplus: after the trade it still holds, of every resource it
  // pays, at least as many as any build it can still make needs.
  if (level === "hard" && RESOURCES.some((r) => (offer.get[r] ?? 0) > 0 && next[r] < need(ts, r)))
    return false;
  return RULES[level].some((rule) => {
    const gain = score(rule, ts, next) - score(rule, ts, hand);
    // Small epsilon: equal hands must count as equal despite float sums.
    return rule.margin > 0 ? gain > rule.margin : gain >= -1e-9;
  });
}
