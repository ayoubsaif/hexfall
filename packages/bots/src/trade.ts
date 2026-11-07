// Offer judge: should a bot accept a domestic trade (specs/bots, "Bots trade with a lone human")?
// Pure and RNG-free: the same view and offer always give the same answer.
import {
  COSTS,
  RESOURCES,
  type PlayerView,
  type ResourceBundle,
  type ResourceCounts,
  type Seat,
  type TradeOffer,
} from "@hexfall/engine";

type Target = "city" | "settlement" | "devCard" | "road";

const WEIGHT: Readonly<Record<Target, number>> = { city: 4, settlement: 4, devCard: 2, road: 1 };
/** How much the bot's score must rise before it says yes. */
const MARGIN = 0.05;
/** Proposers at or above this public VP are never helped. */
const LEADER_VP = 8;

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

function score(ts: readonly Target[], hand: ResourceCounts): number {
  let top = 0;
  for (const t of ts) top = Math.max(top, WEIGHT[t] / (1 + gap(t, hand)));
  const cards = RESOURCES.reduce((n, r) => n + hand[r], 0);
  return top + 0.01 * cards;
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

/** Whether the bot in `seat` should accept `offer` (it is a recipient). */
export function judgeOffer(view: PlayerView, seat: Seat, offer: TradeOffer): boolean {
  const hand = view.players[seat]?.resources;
  if (!hand) return false;
  if ((view.players[offer.from]?.publicVp ?? 0) >= LEADER_VP) return false;
  const next = after(hand, offer);
  if (!next) return false;
  const ts = targets(view, seat);
  // Never give up a card needed for something already affordable.
  if (ts.some((t) => gap(t, hand) === 0 && gap(t, next) > 0)) return false;
  return score(ts, next) > score(ts, hand) + MARGIN;
}
