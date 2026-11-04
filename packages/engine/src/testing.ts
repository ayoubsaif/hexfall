// Test helpers (not rules). Build states directly, without running setup.
import { applyAction, createGame } from "./game.ts";
import type { RngSeed } from "./rng.ts";
import type { Action, Building, GameConfig, GameState, ResourceBundle, Seat } from "./state.ts";
import { RESOURCES } from "./rules/common.ts";
import type { RuleErrorCode } from "./rules/errors.ts";
import type { EdgeId, VertexId } from "./topology.ts";

/** A freshly created game (roll-for-order phase). */
export function makeState({
  seed,
  playerCount = 4,
  mode = "beginner",
}: {
  seed: RngSeed;
  playerCount?: 3 | 4;
  mode?: GameConfig["mode"];
}): GameState {
  return createGame({ seed, playerCount, mode });
}

/**
 * A game already past setup: phase "turn", turn 1, `seat` active, dice rolled
 * (unless `rolled: false`), no pieces on the board, empty hands, full bank.
 * Place pieces with putBuilding / putRoadAt and give cards with give().
 */
export function makePlayState({
  seed = 1,
  playerCount = 4,
  mode = "beginner",
  seat = 0,
  rolled = true,
}: {
  seed?: RngSeed;
  playerCount?: 3 | 4;
  mode?: GameConfig["mode"];
  seat?: Seat;
  rolled?: boolean;
} = {}): GameState {
  const s = createGame({ seed, playerCount, mode });
  s.phase = { kind: "turn" };
  s.turn = { seat, number: 1, rolled, devPlayed: false, dice: rolled ? [3, 4] : null };
  s.log = [];
  return s;
}

/** Puts a building on `v` directly (adjusting the owner's supply). No rule checks. */
export function putBuilding(
  s: GameState,
  v: VertexId,
  owner: Seat,
  kind: Building["kind"] = "settlement",
): void {
  const p = s.players[owner];
  if (!p) throw new Error(`no seat ${owner}`);
  const prev = s.vertices[v];
  if (prev?.kind === "settlement") {
    const prevOwner = s.players[prev.owner];
    if (prevOwner) prevOwner.pieces.settlements++;
  }
  if (kind === "settlement") p.pieces.settlements--;
  else p.pieces.cities--;
  s.vertices[v] = { owner, kind };
}

/** Puts a road on `e` directly (adjusting the owner's supply). No rule checks. */
export function putRoadAt(s: GameState, e: EdgeId, owner: Seat): void {
  const p = s.players[owner];
  if (!p) throw new Error(`no seat ${owner}`);
  p.pieces.roads--;
  s.edges[e] = owner;
}

/** Moves cards from the bank to a hand directly. */
export function give(s: GameState, seat: Seat, b: ResourceBundle): void {
  const p = s.players[seat];
  if (!p) throw new Error(`no seat ${seat}`);
  for (const r of RESOURCES) {
    const v = b[r] ?? 0;
    if (s.bank[r] < v) throw new Error(`bank lacks ${v} ${r}`);
    s.bank[r] -= v;
    p.resources[r] += v;
  }
}

/** Applies an action that must succeed; returns the next state. */
export function step(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`${a.type} failed: ${r.code}: ${r.message}`);
  return r.state;
}

/** Applies an action that must fail; returns the error code. */
export function failCode(s: GameState, a: Action): RuleErrorCode {
  const r = applyAction(s, a);
  if (r.ok) throw new Error(`${a.type} unexpectedly succeeded`);
  return r.code;
}
