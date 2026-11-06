// Heuristic bot: one legal action per call, decided from the bot's own view.
// No trading: every offer is rejected and none is proposed (specs/bots).
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
import type { BotRng } from "./rng.ts";

type Target = "city" | "settlement" | "devCard";
const COST: Readonly<Record<keyof typeof COSTS, ResourceBundle>> = COSTS;
const TARGETS: readonly Target[] = ["city", "settlement", "devCard"];

function best<T>(xs: readonly T[], score: (x: T) => number, rng: BotRng): T | undefined {
  let top: T | undefined;
  let topScore = -Infinity;
  for (const x of xs) {
    const s = score(x) + rng.jitter() * 0.01;
    if (s > topScore) {
      topScore = s;
      top = x;
    }
  }
  return top;
}

function discardBundle(hand: ResourceCounts, n: number, rng: BotRng): ResourceBundle {
  const left = { ...hand };
  const out: ResourceBundle = {};
  for (let i = 0; i < n; i++) {
    // Drop from the biggest pile; this keeps variety for building.
    const r = best(
      RESOURCES.filter((x) => left[x] > 0),
      (x) => left[x],
      rng,
    )!;
    left[r]--;
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

function robberAction(view: PlayerView, legal: LegalActions, seat: Seat, rng: BotRng): Action {
  const score = (o: { hex: number; victims: Seat[] }): number => {
    let s = 0;
    for (const v of TOPOLOGY.hexes[o.hex]!.vertices) {
      const b = view.vertices[v];
      if (!b) continue;
      const w = pips(view.board.hexes[o.hex]!.token) * (b.kind === "city" ? 2 : 1);
      s += b.owner === seat ? -3 * w : w;
    }
    return s;
  };
  const opt = best(legal.moveRobber, score, rng)!;
  const victim = best(
    opt.victims,
    (v) => view.players[v]!.publicVp * 2 + view.players[v]!.resourceCount,
    rng,
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
  rng: BotRng,
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
    const give = best(
      RESOURCES.filter((r) => r !== get && hand[r] - (keep[r] ?? 0) >= legal.maritime![r]),
      (r) => hand[r] - (keep[r] ?? 0),
      rng,
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

/**
 * Picks one action for `seat`, or null when the bot has nothing to do.
 * `rng` is the bot's own generator; the game RNG is never used.
 */
export function chooseAction(view: PlayerView, legal: LegalActions, rng: BotRng): Action | null {
  const seat = view.viewer;
  if (seat === null) return null;
  const me = view.players[seat]!;
  const hand = me.resources;
  if (!hand) return null;
  const owned = producedBy(view, seat);

  if (legal.rollForOrder) return { type: "rollForOrder", seat };
  if (legal.discard > 0)
    return { type: "discard", seat, cards: discardBundle(hand, legal.discard, rng) };
  if (legal.moveRobber.length > 0) return robberAction(view, legal, seat, rng);

  if (legal.placeSettlement.length > 0) {
    const vertex = best(legal.placeSettlement, (v) => vertexValue(view, v, owned), rng)!;
    return { type: "placeSettlement", seat, vertex };
  }
  if (legal.placeRoad.length > 0) {
    const edge = best(legal.placeRoad, (e) => roadValue(view, e, owned), rng)!;
    return { type: "placeRoad", seat, edge };
  }

  // Free roads from Road Building.
  if (view.phase.kind === "roadBuilding" && legal.buildRoad.length > 0) {
    const edge = best(legal.buildRoad, (e) => roadValue(view, e, owned), rng)!;
    return { type: "buildRoad", seat, edge };
  }

  // No trading: turn every offer down.
  const reject = legal.rejectTrade[0];
  if (reject !== undefined) return { type: "rejectTrade", seat, offerId: reject };

  if (legal.rollDice) {
    // A Knight before the roll moves the robber off our own hex.
    if (legal.playDevCard.includes("knight") && ownsHexBuilding(view, seat, view.robber)) {
      return { type: "playKnight", seat };
    }
    return { type: "rollDice", seat };
  }

  if (legal.revealVictoryPoints) return { type: "revealVictoryPoints", seat };

  if (legal.buildCity.length > 0) {
    const vertex = best(legal.buildCity, (v) => vertexPips(view, v), rng)!;
    return { type: "buildCity", seat, vertex };
  }
  if (legal.buildSettlement.length > 0) {
    const vertex = best(legal.buildSettlement, (v) => vertexValue(view, v, owned), rng)!;
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
      const resource = best(RESOURCES, gap, rng)!;
      return { type: "playMonopoly", seat, resource };
    }
    if (card === "roadBuilding" && legal.buildRoad.length > 0 && me.pieces.roads >= 2) {
      return { type: "playRoadBuilding", seat };
    }
  }

  // Paid road only when it opens a useful site and no settlement spot is open.
  if (legal.buildRoad.length > 0 && legal.buildSettlement.length === 0) {
    const edge = best(legal.buildRoad, (e) => roadValue(view, e, owned), rng)!;
    if (roadValue(view, edge, owned) >= 5) return { type: "buildRoad", seat, edge };
  }

  const trade = maritime(view, legal, seat, hand, rng);
  if (trade) return trade;

  if (legal.endTurn) return { type: "endTurn", seat };
  return null;
}
