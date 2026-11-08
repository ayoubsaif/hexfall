// Heuristic bot: one legal action per call, decided from the bot's own view.
// Never proposes trades. Offers are rejected unless `trade` is on (one-human rooms), when
// each is judged on its merits (trade.ts, specs/bots). The level changes only which legal
// option is picked (specs/bots "Bot difficulty levels").
import {
  COSTS,
  RESOURCES,
  TOPOLOGY,
  type Action,
  type LegalActions,
  type PlayerView,
  type Resource,
  type ResourceBundle,
  type ResourceCounts,
  type Seat,
} from "@hexfall/engine";
import { pips, producedBy, roadValue, total, vertexPips, vertexValue } from "./eval.ts";
import type { BotLevel } from "./level.ts";
import type { BotRng } from "./rng.ts";
import { judgeOffer } from "./trade.ts";

type Target = "city" | "settlement" | "devCard";
const COST: Readonly<Record<keyof typeof COSTS, ResourceBundle>> = COSTS;
const TARGETS: readonly Target[] = ["city", "settlement", "devCard"];

/** Picks the top-scored option; picks among several options vary by level. */
type Picker = <T>(xs: readonly T[], score: (x: T) => number) => T | undefined;

/** Jitter scale per level: Normal breaks ties at random, Hard almost never. */
const JITTER: Readonly<Record<BotLevel, number>> = { easy: 0.01, normal: 0.01, hard: 1e-6 };
/** Easy picks a random option instead of its best one about once in this many choices. */
const EASY_SLIP = 3;

function best<T>(
  xs: readonly T[],
  score: (x: T) => number,
  rng: BotRng,
  level: BotLevel = "normal",
): T | undefined {
  if (level === "easy" && xs.length > 1 && rng.int(EASY_SLIP) === 0) return rng.pick(xs);
  let top: T | undefined;
  let topScore = -Infinity;
  for (const x of xs) {
    const s = score(x) + rng.jitter() * JITTER[level];
    if (s > topScore) {
      topScore = s;
      top = x;
    }
  }
  return top;
}

function discardBundle(hand: ResourceCounts, n: number, pick: Picker): ResourceBundle {
  const left = { ...hand };
  const out: ResourceBundle = {};
  for (let i = 0; i < n; i++) {
    // Drop from the biggest pile; this keeps variety for building.
    const r = pick(
      RESOURCES.filter((x) => left[x] > 0),
      (x) => left[x],
    )!;
    left[r]--;
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

/** The opponent with the most public VP (ties: more cards, then lower seat). */
function leaderOf(view: PlayerView, seat: Seat, among?: readonly Seat[]): Seat | null {
  let top: Seat | null = null;
  view.players.forEach((p, s) => {
    if (s === seat || (among && !among.includes(s))) return;
    const t = top === null ? null : view.players[top]!;
    if (
      t === null ||
      p.publicVp > t.publicVp ||
      (p.publicVp === t.publicVp && p.resourceCount > t.resourceCount)
    )
      top = s;
  });
  return top;
}

function robberAction(
  view: PlayerView,
  legal: LegalActions,
  seat: Seat,
  rng: BotRng,
  level: BotLevel,
  pick: Picker,
): Action {
  // Hard weighs the leader's buildings double, so the robber blocks the leader first.
  const leader = level === "hard" ? leaderOf(view, seat) : null;
  const score = (o: { hex: number; victims: Seat[] }): number => {
    let s = 0;
    for (const v of TOPOLOGY.hexes[o.hex]!.vertices) {
      const b = view.vertices[v];
      if (!b) continue;
      const w = pips(view.board.hexes[o.hex]!.token) * (b.kind === "city" ? 2 : 1);
      s += b.owner === seat ? -3 * w : b.owner === leader ? 2 * w : w;
    }
    if (leader !== null && o.victims.includes(leader)) s += 1;
    return s;
  };
  const opt = pick(legal.moveRobber, score)!;
  let victim: Seat | undefined;
  if (opt.victims.length === 0) victim = undefined;
  else if (level === "easy") victim = rng.pick(opt.victims);
  else if (level === "hard") victim = leaderOf(view, seat, opt.victims) ?? undefined;
  else
    victim = pick(
      opt.victims,
      (v) => view.players[v]!.publicVp * 2 + view.players[v]!.resourceCount,
    );
  return { type: "moveRobber", seat, hex: opt.hex, victim: victim ?? null };
}

function missing(hand: ResourceCounts, cost: ResourceBundle): ResourceBundle {
  const out: ResourceBundle = {};
  for (const r of RESOURCES) {
    const d = (cost[r] ?? 0) - hand[r];
    if (d > 0) out[r] = d;
  }
  return out;
}

function maritime(
  view: PlayerView,
  legal: LegalActions,
  seat: Seat,
  hand: ResourceCounts,
  pick: Picker,
): Action | null {
  if (!legal.maritime) return null;
  const me = view.players[seat]!;
  const canCity =
    me.pieces.cities > 0 && view.vertices.some((b) => b?.owner === seat && b.kind === "settlement");
  const canSettle = me.pieces.settlements > 0;
  const targets = TARGETS.filter(
    (t) =>
      (t === "city" && canCity) ||
      (t === "settlement" && canSettle) ||
      (t === "devCard" && view.devDeckCount > 0),
  );
  // Keep anything a target needs, so one trade never undoes another.
  const keep: ResourceBundle = {};
  for (const t of targets)
    for (const r of RESOURCES) keep[r] = Math.max(keep[r] ?? 0, COST[t][r] ?? 0);
  for (const t of targets) {
    const lack = missing(hand, COST[t]);
    const want = RESOURCES.filter((r) => (lack[r] ?? 0) > 0);
    const n = want.reduce((s, r) => s + (lack[r] ?? 0), 0);
    if (n < 1 || n > 2) continue;
    const get = want.find((r) => view.bank[r] > 0);
    if (!get) continue;
    const give = pick(
      RESOURCES.filter((r) => r !== get && hand[r] - (keep[r] ?? 0) >= legal.maritime![r]),
      (r) => hand[r] - (keep[r] ?? 0),
    );
    if (give) return { type: "maritimeTrade", seat, give, get, count: 1 };
  }
  return null;
}

function yearOfPlenty(view: PlayerView, hand: ResourceCounts): Resource[] {
  const bank = { ...view.bank };
  const want = Math.min(2, total(bank));
  const have = { ...hand };
  const out: Resource[] = [];
  for (let i = 0; i < want; i++) {
    // Fill the biggest gap to a city, then a settlement.
    const gap = (r: Resource) =>
      Math.max(0, (COST.city[r] ?? 0) - have[r]) * 2 +
      Math.max(0, (COST.settlement[r] ?? 0) - have[r]);
    const r = RESOURCES.filter((x) => bank[x] > 0).sort((a, b) => gap(b) - gap(a))[0]!;
    bank[r]--;
    have[r]++;
    out.push(r);
  }
  return out;
}

function ownsHexBuilding(view: PlayerView, seat: Seat, hex: number): boolean {
  return TOPOLOGY.hexes[hex]!.vertices.some((v) => view.vertices[v]?.owner === seat);
}

export interface ChooseOptions {
  /** Answer offers on their merits instead of rejecting them all. */
  trade: boolean;
  /** Difficulty; Normal when absent. */
  level?: BotLevel;
}

/**
 * Picks one action for `seat`, or null when the bot has nothing to do.
 * `rng` is the bot's own generator; the game RNG is never used.
 */
export function chooseAction(
  view: PlayerView,
  legal: LegalActions,
  rng: BotRng,
  options: ChooseOptions = { trade: false },
): Action | null {
  const seat = view.viewer;
  if (seat === null) return null;
  const me = view.players[seat]!;
  const hand = me.resources;
  if (!hand) return null;
  const owned = producedBy(view, seat);
  const level = options.level ?? "normal";
  const pick: Picker = (xs, score) => best(xs, score, rng, level);

  if (legal.rollForOrder) return { type: "rollForOrder", seat };
  if (legal.discard > 0)
    return { type: "discard", seat, cards: discardBundle(hand, legal.discard, pick) };
  if (legal.moveRobber.length > 0) return robberAction(view, legal, seat, rng, level, pick);

  if (legal.placeSettlement.length > 0) {
    const vertex = pick(legal.placeSettlement, (v) => vertexValue(view, v, owned))!;
    return { type: "placeSettlement", seat, vertex };
  }
  if (legal.placeRoad.length > 0) {
    const edge = pick(legal.placeRoad, (e) => roadValue(view, e, owned))!;
    return { type: "placeRoad", seat, edge };
  }

  // Free roads from Road Building.
  if (view.phase.kind === "roadBuilding" && legal.buildRoad.length > 0) {
    const edge = pick(legal.buildRoad, (e) => roadValue(view, e, owned))!;
    return { type: "buildRoad", seat, edge };
  }

  // Withdraw an offer left by a human who held this seat, then answer the oldest open offer.
  const cancel = legal.cancelTrade[0];
  if (cancel !== undefined) return { type: "cancelTrade", seat, offerId: cancel };
  const answer = legal.rejectTrade[0];
  if (answer !== undefined) {
    const offer = view.offers.find((o) => o.id === answer);
    if (
      options.trade &&
      offer &&
      legal.acceptTrade.includes(answer) &&
      judgeOffer(view, seat, offer, level)
    ) {
      return { type: "acceptTrade", seat, offerId: answer };
    }
    return { type: "rejectTrade", seat, offerId: answer };
  }

  if (legal.rollDice) {
    // A Knight before the roll moves the robber off our own hex.
    if (legal.playDevCard.includes("knight") && ownsHexBuilding(view, seat, view.robber)) {
      return { type: "playKnight", seat };
    }
    return { type: "rollDice", seat };
  }

  if (legal.revealVictoryPoints) return { type: "revealVictoryPoints", seat };

  if (legal.buildCity.length > 0) {
    const vertex = pick(legal.buildCity, (v) => vertexPips(view, v))!;
    return { type: "buildCity", seat, vertex };
  }
  if (legal.buildSettlement.length > 0) {
    const vertex = pick(legal.buildSettlement, (v) => vertexValue(view, v, owned))!;
    return { type: "buildSettlement", seat, vertex };
  }
  if (legal.buyDevCard) return { type: "buyDevCard", seat };

  for (const card of legal.playDevCard) {
    if (card === "knight") return { type: "playKnight", seat };
    if (card === "yearOfPlenty") {
      return { type: "playYearOfPlenty", seat, resources: yearOfPlenty(view, hand) };
    }
    if (card === "monopoly") {
      // Ask for what we lack most.
      const gap = (r: Resource) => Math.max(0, (COST.city[r] ?? 0) - hand[r]) + 0.1 * (4 - hand[r]);
      const resource = pick(RESOURCES, gap)!;
      return { type: "playMonopoly", seat, resource };
    }
    if (card === "roadBuilding" && legal.buildRoad.length > 0 && me.pieces.roads >= 2) {
      return { type: "playRoadBuilding", seat };
    }
  }

  // Paid road only when it opens a useful site and no settlement spot is open.
  if (legal.buildRoad.length > 0 && legal.buildSettlement.length === 0) {
    const edge = pick(legal.buildRoad, (e) => roadValue(view, e, owned))!;
    if (roadValue(view, edge, owned) >= 5) return { type: "buildRoad", seat, edge };
  }

  const trade = maritime(view, legal, seat, hand, pick);
  if (trade) return trade;

  if (legal.endTurn) return { type: "endTurn", seat };
  return null;
}
