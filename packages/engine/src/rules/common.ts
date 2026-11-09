// Shared rule helpers: costs, resource bundles, turn guards, VP, RNG draws.
import type { Resource } from "../board.ts";
import { RESOURCES } from "../costs.ts";
import { nextInt } from "../rng.ts";
import type {
  Building,
  GameEvent,
  GameState,
  PhaseKind,
  ResourceBundle,
  ResourceCounts,
  Seat,
} from "../state.ts";
import { topologyOf, type HexId, type Topology, type VertexId } from "../topology.ts";
import { RuleError, check } from "./errors.ts";

export { COSTS, RESOURCES } from "../costs.ts";

/** Victory target when none is chosen (AGENTS.md §12). */
export const DEFAULT_VICTORY_TARGET = 10;
export const MIN_VICTORY_TARGET = 8;
export const MAX_VICTORY_TARGET = 15;

/** The topology of the game's board. */
export function topo(s: { readonly board: GameState["board"] }): Topology {
  return topologyOf(s.board);
}

/** VP needed to win (states stored before the option existed play to 10). */
export function victoryTargetOf(s: Partial<Pick<GameState, "victoryTarget">>): number {
  return s.victoryTarget ?? DEFAULT_VICTORY_TARGET;
}

export function emptyCounts(): ResourceCounts {
  return { brick: 0, grain: 0, lumber: 0, ore: 0, wool: 0 };
}

export function isResource(x: unknown): x is Resource {
  return typeof x === "string" && (RESOURCES as readonly string[]).includes(x);
}

/** Total cards in a bundle or counts record. */
export function cardTotal(b: ResourceBundle): number {
  let n = 0;
  for (const r of RESOURCES) n += b[r] ?? 0;
  return n;
}

/**
 * True if `b` is a well-formed bundle: only resource keys, each a non-negative
 * integer. Use before trusting any bundle that came from an action.
 */
export function isValidBundle(b: unknown): b is ResourceBundle {
  if (b === null || typeof b !== "object" || Array.isArray(b)) return false;
  for (const [k, v] of Object.entries(b)) {
    if (!isResource(k)) return false;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return false;
  }
  return true;
}

/** Copy of a bundle without zero entries, in RESOURCES order. */
export function normalizeBundle(b: ResourceBundle): ResourceBundle {
  const out: ResourceBundle = {};
  for (const r of RESOURCES) {
    const v = b[r] ?? 0;
    if (v > 0) out[r] = v;
  }
  return out;
}

export function hasCards(have: ResourceCounts, need: ResourceBundle): boolean {
  return RESOURCES.every((r) => have[r] >= (need[r] ?? 0));
}

/** Moves `b` from the player's hand to the bank. Throws insufficient_resources. */
export function payToBank(s: GameState, seat: Seat, b: ResourceBundle): void {
  const hand = playerOf(s, seat).resources;
  check(hasCards(hand, b), "insufficient_resources", "not enough resources");
  for (const r of RESOURCES) {
    const v = b[r] ?? 0;
    hand[r] -= v;
    s.bank[r] += v;
  }
}

/** Moves `b` from the bank to the player's hand. Throws bank_empty if the bank lacks it. */
export function takeFromBank(s: GameState, seat: Seat, b: ResourceBundle): void {
  check(hasCards(s.bank, b), "bank_empty", "the bank does not have those cards");
  const hand = playerOf(s, seat).resources;
  for (const r of RESOURCES) {
    const v = b[r] ?? 0;
    s.bank[r] -= v;
    hand[r] += v;
  }
}

/** Moves `b` between two hands (both must be checked by the caller). */
export function transfer(s: GameState, from: Seat, to: Seat, b: ResourceBundle): void {
  const src = playerOf(s, from).resources;
  const dst = playerOf(s, to).resources;
  check(hasCards(src, b), "insufficient_resources", `seat ${from} lacks the cards`);
  for (const r of RESOURCES) {
    const v = b[r] ?? 0;
    src[r] -= v;
    dst[r] += v;
  }
}

export function playerOf(s: GameState, seat: Seat) {
  const p = s.players[seat];
  if (!p) throw new RuleError("invalid_action", `no seat ${seat}`);
  return p;
}

export function emit(s: GameState, event: GameEvent): void {
  s.log.push(event);
}

export function nextSeat(s: GameState, seat: Seat): Seat {
  return (seat + 1) % s.playerCount;
}

// ---- Guards (handlers call these in this order for consistent error codes)

export function assertPhase(s: GameState, ...kinds: PhaseKind[]): void {
  check(kinds.includes(s.phase.kind), "wrong_phase", `not allowed during ${s.phase.kind}`);
}

export function assertActive(s: GameState, seat: Seat): void {
  check(s.turn.seat === seat, "not_your_turn", `seat ${seat} is not the active player`);
}

export function assertRolled(s: GameState): void {
  check(s.turn.rolled, "must_roll_first", "roll the dice first");
}

/** Phase "turn", seat active and dice rolled: the trade/build window. */
export function inBuildWindow(s: GameState, seat: Seat): boolean {
  return s.phase.kind === "turn" && s.turn.seat === seat && s.turn.rolled;
}

/** True if it is the seat's Special Building Phase window. */
export function inSpecialBuild(s: GameState, seat: Seat): boolean {
  return s.phase.kind === "specialBuild" && s.phase.current === seat;
}

/** The seat may build and buy now: its own rolled turn, or its Special Building Phase window. */
export function mayBuildNow(s: GameState, seat: Seat): boolean {
  return inBuildWindow(s, seat) || inSpecialBuild(s, seat);
}

/** Guard for building and buying, with the same codes as before for normal turns. */
export function assertMayBuild(s: GameState, seat: Seat): void {
  if (s.phase.kind === "specialBuild") {
    check(s.phase.current === seat, "not_your_turn", `it is not seat ${seat}'s building window`);
    return;
  }
  assertPhase(s, "turn");
  assertActive(s, seat);
  assertRolled(s);
}

// ---- Board queries

export function buildingAt(s: GameState, v: VertexId): Building | null {
  return s.vertices[v] ?? null;
}

/** Opponents of `seat` with a building on a corner of `hex`, ascending. */
export function opponentsOnHex(s: GameState, hex: HexId, seat: Seat): Seat[] {
  const info = topo(s).hexes[hex];
  if (!info) return [];
  const out = new Set<Seat>();
  for (const v of info.vertices) {
    const b = s.vertices[v];
    if (b && b.owner !== seat) out.add(b.owner);
  }
  return [...out].sort((a, b) => a - b);
}

// ---- Victory points

/** VP visible to everyone: buildings, special cards and revealed VP cards. */
export function publicVp(s: GameState, seat: Seat): number {
  let vp = 0;
  for (const b of s.vertices) {
    if (b && b.owner === seat) vp += b.kind === "city" ? 2 : 1;
  }
  if (s.longestRoad === seat) vp += 2;
  if (s.largestArmy === seat) vp += 2;
  return vp + playerOf(s, seat).revealedVp;
}

/** Unrevealed VP cards in hand. */
export function hiddenVp(s: GameState, seat: Seat): number {
  return playerOf(s, seat).devCards.filter((c) => c === "victoryPoint").length;
}

// ---- RNG draws (all randomness goes through here)

/** Uniform integer in [0, n), advancing s.rng. */
export function randInt(s: GameState, n: number): number {
  const [x, next] = nextInt(s.rng, n);
  s.rng = next;
  return x;
}

/** Rolls two dice: die 1 first (replay contract). */
export function rollTwoDice(s: GameState): [number, number] {
  const a = randInt(s, 6) + 1;
  const b = randInt(s, 6) + 1;
  return [a, b];
}
