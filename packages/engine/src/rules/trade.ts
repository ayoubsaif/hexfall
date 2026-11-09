// Domestic and maritime trade (AGENTS.md §11, §13.12). Owner: cards agent.
import type { HarborType } from "../board.ts";
import type {
  ActionOf,
  GameState,
  ResourceBundle,
  ResourceCounts,
  Seat,
  TradeOffer,
} from "../state.ts";
import {
  RESOURCES,
  assertActive,
  assertPhase,
  assertRolled,
  cardTotal,
  emit,
  emptyCounts,
  hasCards,
  isResource,
  isValidBundle,
  normalizeBundle,
  payToBank,
  playerOf,
  takeFromBank,
  transfer,
  topo,
} from "./common.ts";
import { check } from "./errors.ts";

/** Harbor types the seat owns (a building on either slot intersection), deduplicated. */
export function harborsOf(s: GameState, seat: Seat): HarborType[] {
  const out: HarborType[] = [];
  topo(s).harborSlots.forEach((edge, slot) => {
    const info = topo(s).edges[edge];
    const type = s.board.harbors[slot];
    if (!info || type === undefined) return;
    const owned = info.vertices.some((v) => s.vertices[v]?.owner === seat);
    if (owned && !out.includes(type)) out.push(type);
  });
  return out;
}

/** Best bank rate per resource for the seat (4, 3 or 2), regardless of phase or hand. */
export function maritimeRates(s: GameState, seat: Seat): ResourceCounts {
  const harbors = harborsOf(s, seat);
  const base = harbors.includes("generic") ? 3 : 4;
  const rates = emptyCounts();
  for (const r of RESOURCES) rates[r] = harbors.includes(r) ? 2 : base;
  return rates;
}

export function canProposeTrade(s: GameState, _seat: Seat): boolean {
  return s.phase.kind === "turn" && s.turn.rolled;
}

function offerHandsOk(s: GameState, o: TradeOffer, by: Seat): boolean {
  const from = s.players[o.from];
  const to = s.players[by];
  return !!from && !!to && hasCards(from.resources, o.give) && hasCards(to.resources, o.get);
}

/** Open offer ids the seat may accept, reject or cancel right now. */
export function tradeOptions(
  s: GameState,
  seat: Seat,
): { accept: number[]; reject: number[]; cancel: number[] } {
  const out = { accept: [] as number[], reject: [] as number[], cancel: [] as number[] };
  if (s.phase.kind !== "turn") return out;
  const offers = [...s.offers].sort((a, b) => a.id - b.id);
  for (const o of offers) {
    const addressed = o.to.includes(seat) && !o.rejectedBy.includes(seat);
    if (addressed) {
      if (offerHandsOk(s, o, seat)) out.accept.push(o.id);
      out.reject.push(o.id);
    }
    if (o.from === seat) out.cancel.push(o.id);
  }
  return out;
}

function isSeat(s: GameState, x: unknown): x is Seat {
  return typeof x === "number" && Number.isInteger(x) && x >= 0 && x < s.playerCount;
}

export function proposeTrade(s: GameState, a: ActionOf<"proposeTrade">): void {
  assertPhase(s, "turn");
  assertRolled(s);
  check(isValidBundle(a.give) && isValidBundle(a.get), "invalid_trade", "malformed bundle");
  const give = normalizeBundle(a.give);
  const get = normalizeBundle(a.get);
  check(cardTotal(give) > 0 && cardTotal(get) > 0, "invalid_trade", "both sides must give cards");
  check(
    RESOURCES.every((r) => !(give[r] && get[r])),
    "invalid_trade",
    "the same resource may not be on both sides",
  );
  check(Array.isArray(a.to), "invalid_trade", "to must be a list of seats");
  const to: Seat[] = a.to;
  const active = s.turn.seat;
  if (a.seat === active) {
    check(to.length > 0, "invalid_trade", "address at least one opponent");
    check(
      to.every((t) => isSeat(s, t) && t !== a.seat) && new Set(to).size === to.length,
      "invalid_trade",
      "addressees must be distinct opponents",
    );
  } else {
    check(
      to.length === 1 && to[0] === active,
      "invalid_trade",
      "offers from non-active players must go to the active player only",
    );
  }
  check(
    hasCards(playerOf(s, a.seat).resources, give),
    "insufficient_resources",
    "you do not hold the offered cards",
  );
  const offer: TradeOffer = {
    id: s.nextOfferId++,
    from: a.seat,
    to: [...to],
    give,
    get,
    rejectedBy: [],
  };
  s.offers.push(offer);
  emit(s, { type: "tradeOffered", offer: copyJson(offer) });
}

function copyJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function findOffer(s: GameState, id: number): TradeOffer {
  const o = s.offers.find((x) => x.id === id);
  check(o, "unknown_offer", `no open offer ${String(id)}`);
  return o;
}

function removeOffer(s: GameState, id: number): void {
  s.offers = s.offers.filter((o) => o.id !== id);
}

export function acceptTrade(s: GameState, a: ActionOf<"acceptTrade">): void {
  const o = findOffer(s, a.offerId);
  assertPhase(s, "turn");
  check(
    o.to.includes(a.seat) && !o.rejectedBy.includes(a.seat),
    "invalid_trade",
    "this offer is not open to you",
  );
  check(offerHandsOk(s, o, a.seat), "insufficient_resources", "a side lacks the cards");
  transfer(s, o.from, a.seat, o.give);
  transfer(s, a.seat, o.from, o.get);
  removeOffer(s, o.id);
  emit(s, {
    type: "tradeAccepted",
    offerId: o.id,
    from: o.from,
    by: a.seat,
    give: { ...o.give },
    get: { ...o.get },
  });
}

export function rejectTrade(s: GameState, a: ActionOf<"rejectTrade">): void {
  const o = findOffer(s, a.offerId);
  assertPhase(s, "turn");
  check(
    o.to.includes(a.seat) && !o.rejectedBy.includes(a.seat),
    "invalid_trade",
    "this offer is not open to you",
  );
  o.rejectedBy.push(a.seat);
  emit(s, { type: "tradeRejected", offerId: o.id, seat: a.seat });
  if (o.to.every((t) => o.rejectedBy.includes(t))) removeOffer(s, o.id);
}

export function cancelTrade(s: GameState, a: ActionOf<"cancelTrade">): void {
  const o = findOffer(s, a.offerId);
  check(o.from === a.seat, "invalid_trade", "only the proposer may cancel");
  removeOffer(s, o.id);
  emit(s, { type: "tradeCancelled", offerId: o.id });
}

export function maritimeTrade(s: GameState, a: ActionOf<"maritimeTrade">): void {
  assertPhase(s, "turn");
  assertActive(s, a.seat);
  assertRolled(s);
  check(
    isResource(a.give) &&
      isResource(a.get) &&
      a.give !== a.get &&
      typeof a.count === "number" &&
      Number.isInteger(a.count) &&
      a.count > 0,
    "invalid_trade",
    "invalid maritime trade",
  );
  const rate = maritimeRates(s, a.seat)[a.give];
  const giveCount = rate * a.count;
  const hand = playerOf(s, a.seat).resources;
  check(hand[a.give] >= giveCount, "insufficient_resources", `need ${giveCount} ${a.give}`);
  check(s.bank[a.get] >= a.count, "bank_empty", `the bank lacks ${a.count} ${a.get}`);
  const pay: ResourceBundle = { [a.give]: giveCount };
  const take: ResourceBundle = { [a.get]: a.count };
  payToBank(s, a.seat, pay);
  takeFromBank(s, a.seat, take);
  emit(s, {
    type: "maritimeTrade",
    seat: a.seat,
    give: a.give,
    giveCount,
    get: a.get,
    getCount: a.count,
  });
}
