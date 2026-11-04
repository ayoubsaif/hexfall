// Development cards (AGENTS.md §7d, §9, §13.9). Owner: cards agent.
import type { Resource } from "../board.ts";
import type { ActionOf, DevCard, GameState, PlayableDevCard, Seat } from "../state.ts";
import type { EdgeId } from "../topology.ts";
import {
  COSTS,
  WIN_VP,
  assertActive,
  assertPhase,
  assertRolled,
  cardTotal,
  emit,
  emptyCounts,
  hasCards,
  hiddenVp,
  inBuildWindow,
  isResource,
  payToBank,
  playerOf,
  publicVp,
  takeFromBank,
} from "./common.ts";
import { check } from "./errors.ts";
import { updateLargestArmy } from "./largestArmy.ts";
import { connectedRoadEdges, putRoad } from "./placement.ts";

const PLAY_ORDER: readonly PlayableDevCard[] = [
  "knight",
  "roadBuilding",
  "yearOfPlenty",
  "monopoly",
];

function count(cards: readonly DevCard[], card: DevCard): number {
  let n = 0;
  for (const c of cards) if (c === card) n++;
  return n;
}

/** Removes one occurrence of `card` from `cards` (from the end, newest first). */
function removeOne(cards: DevCard[], card: DevCard): boolean {
  const i = cards.lastIndexOf(card);
  if (i < 0) return false;
  cards.splice(i, 1);
  return true;
}

export function canBuyDevCard(s: GameState, seat: Seat): boolean {
  return (
    inBuildWindow(s, seat) &&
    s.devDeck.length > 0 &&
    hasCards(playerOf(s, seat).resources, COSTS.devCard)
  );
}

/** Copies of `card` the seat held before this turn (playable if no card was played yet). */
function oldCopies(s: GameState, seat: Seat, card: PlayableDevCard): number {
  const p = playerOf(s, seat);
  return count(p.devCards, card) - count(p.boughtThisTurn, card);
}

function canPlay(s: GameState, seat: Seat, card: PlayableDevCard): boolean {
  return (
    s.phase.kind === "turn" &&
    s.turn.seat === seat &&
    !s.turn.devPlayed &&
    oldCopies(s, seat, card) > 0
  );
}

/** Non-VP card types the seat may play right now, distinct, in a fixed order. */
export function playableDevCards(s: GameState, seat: Seat): PlayableDevCard[] {
  if (!s.players[seat]) return [];
  // Year of Plenty always has a legal choice: min(2, bank total) cards, possibly none.
  return PLAY_ORDER.filter((c) => canPlay(s, seat, c));
}

/** True on the seat's own turn when public + hidden VP >= 10 and they hold a VP card. */
export function canRevealVictoryPoints(s: GameState, seat: Seat): boolean {
  if (s.phase.kind !== "turn" || s.turn.seat !== seat || !s.players[seat]) return false;
  const hidden = hiddenVp(s, seat);
  return hidden > 0 && publicVp(s, seat) + hidden >= WIN_VP;
}

/** Free road paths during the Road Building phase (empty otherwise). */
export function roadBuildingRoads(s: GameState, seat: Seat): EdgeId[] {
  if (s.phase.kind !== "roadBuilding" || s.turn.seat !== seat) return [];
  return connectedRoadEdges(s, seat);
}

export function buyDevCard(s: GameState, a: ActionOf<"buyDevCard">): void {
  assertPhase(s, "turn");
  assertActive(s, a.seat);
  assertRolled(s);
  check(s.devDeck.length > 0, "deck_empty", "the development deck is empty");
  payToBank(s, a.seat, COSTS.devCard);
  const card = s.devDeck.pop();
  check(card !== undefined, "deck_empty", "the development deck is empty");
  const p = playerOf(s, a.seat);
  p.devCards.push(card);
  p.boughtThisTurn.push(card);
  emit(s, { type: "devCardBought", seat: a.seat, card });
}

/** Guards for playing a Knight or Progress card (phase, active, limit, playability). */
function assertPlayable(s: GameState, seat: Seat, card: PlayableDevCard): void {
  assertPhase(s, "turn");
  assertActive(s, seat);
  check(
    !s.turn.devPlayed,
    "dev_card_already_played",
    "a development card was already played this turn",
  );
  check(oldCopies(s, seat, card) > 0, "card_not_playable", `no playable ${card} in hand`);
}

/** Consumes one card of the type (call after all validation). */
function consume(s: GameState, seat: Seat, card: PlayableDevCard): void {
  // Some copy predates this turn, so removing any copy keeps boughtThisTurn a sub-multiset.
  removeOne(playerOf(s, seat).devCards, card);
  s.turn.devPlayed = true;
  if (card !== "knight") s.removedCards.push(card);
  emit(s, { type: "devCardPlayed", seat, card });
}

/** Guards plus consumption, for cards that take no further input. */
function beginPlay(s: GameState, seat: Seat, card: PlayableDevCard): void {
  assertPlayable(s, seat, card);
  consume(s, seat, card);
}

export function playKnight(s: GameState, a: ActionOf<"playKnight">): void {
  beginPlay(s, a.seat, "knight");
  playerOf(s, a.seat).knights++;
  updateLargestArmy(s);
  s.phase = { kind: "moveRobber", source: "knight" };
}

export function playRoadBuilding(s: GameState, a: ActionOf<"playRoadBuilding">): void {
  beginPlay(s, a.seat, "roadBuilding");
  const remaining = Math.min(2, playerOf(s, a.seat).pieces.roads);
  if (remaining > 0 && connectedRoadEdges(s, a.seat).length > 0) {
    s.phase = { kind: "roadBuilding", remaining };
  }
}

/** A buildRoad action during the Road Building phase. */
export function placeFreeRoad(s: GameState, a: ActionOf<"buildRoad">): void {
  const phase = s.phase;
  check(phase.kind === "roadBuilding", "wrong_phase", `not allowed during ${phase.kind}`);
  assertActive(s, a.seat);
  check(
    roadBuildingRoads(s, a.seat).includes(a.edge),
    "illegal_placement",
    `cannot place a road on ${String(a.edge)}`,
  );
  putRoad(s, a.seat, a.edge, true);
  const remaining = phase.remaining - 1;
  if (
    remaining <= 0 ||
    playerOf(s, a.seat).pieces.roads <= 0 ||
    connectedRoadEdges(s, a.seat).length === 0
  ) {
    s.phase = { kind: "turn" };
  } else {
    s.phase = { kind: "roadBuilding", remaining };
  }
}

export function playYearOfPlenty(s: GameState, a: ActionOf<"playYearOfPlenty">): void {
  assertPlayable(s, a.seat, "yearOfPlenty");
  const resources: unknown = a.resources;
  check(
    Array.isArray(resources) && resources.every((r) => isResource(r)),
    "invalid_action",
    "resources must be a list of resource types",
  );
  const picks = resources as Resource[];
  const want = Math.min(2, cardTotal(s.bank));
  check(picks.length === want, "invalid_action", `choose exactly ${want} resources`);
  const bundle = emptyCounts();
  for (const r of picks) bundle[r]++;
  check(hasCards(s.bank, bundle), "bank_empty", "the bank does not have those cards");
  consume(s, a.seat, "yearOfPlenty");
  takeFromBank(s, a.seat, bundle);
  emit(s, { type: "yearOfPlenty", seat: a.seat, resources: [...picks] });
}

export function playMonopoly(s: GameState, a: ActionOf<"playMonopoly">): void {
  assertPlayable(s, a.seat, "monopoly");
  check(isResource(a.resource), "invalid_action", "name a resource type");
  consume(s, a.seat, "monopoly");
  const r = a.resource;
  const me = playerOf(s, a.seat).resources;
  const taken = s.players.map((p, seat) => {
    if (seat === a.seat) return 0;
    const n = p.resources[r];
    p.resources[r] = 0;
    me[r] += n;
    return n;
  });
  emit(s, { type: "monopoly", seat: a.seat, resource: r, taken });
}

export function revealVictoryPoints(s: GameState, a: ActionOf<"revealVictoryPoints">): void {
  assertPhase(s, "turn");
  assertActive(s, a.seat);
  check(canRevealVictoryPoints(s, a.seat), "cannot_reveal", "revealing would not reach 10 VP");
  const p = playerOf(s, a.seat);
  const n = count(p.devCards, "victoryPoint");
  p.devCards = p.devCards.filter((c) => c !== "victoryPoint");
  p.boughtThisTurn = p.boughtThisTurn.filter((c) => c !== "victoryPoint");
  p.revealedVp += n;
  emit(s, { type: "vpRevealed", seat: a.seat, count: n });
}
