// Test-only game fixtures built with the real engine (tests may run engine code;
// app code never does). Mirrors the engine's own test helpers.
import {
  applyAction,
  createGame,
  legalActions,
  playerView,
  type Action,
  type GameState,
  type LegalActions,
  type PlayerView,
  type ResourceBundle,
  type Seat,
} from "@hexfall/engine";
import { RESOURCES, STANDARD_TOPOLOGY } from "@hexfall/engine/geometry";

/** Setup phase, seat 0 places first (no roll for order). */
export function setupState(playerCount: 3 | 4 = 4, seed = 1): GameState {
  return createGame({ seed, playerCount, mode: "beginner", startingPlayer: 0 });
}

/** Main turn 1 for `seat`, rolled unless `rolled: false`, empty board and hands. */
export function playState({
  seat = 0,
  rolled = true,
  playerCount = 4,
  seed = 1,
}: { seat?: Seat; rolled?: boolean; playerCount?: 3 | 4; seed?: number } = {}): GameState {
  const s = createGame({ seed, playerCount, mode: "beginner" });
  s.phase = { kind: "turn" };
  s.turn = { seat, number: 1, rolled, devPlayed: false, dice: rolled ? [3, 4] : null };
  s.log = [];
  return s;
}

export function put(
  s: GameState,
  v: number,
  owner: Seat,
  kind: "settlement" | "city" = "settlement",
): void {
  const p = s.players[owner]!;
  if (kind === "settlement") p.pieces.settlements--;
  else p.pieces.cities--;
  s.vertices[v] = { owner, kind };
}

export function road(s: GameState, e: number, owner: Seat): void {
  s.players[owner]!.pieces.roads--;
  s.edges[e] = owner;
}

export function give(s: GameState, seat: Seat, b: ResourceBundle): void {
  for (const r of RESOURCES) {
    const n = b[r] ?? 0;
    s.bank[r] -= n;
    s.players[seat]!.resources[r] += n;
  }
}

export function step(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`${a.type} failed: ${r.code}: ${r.message}`);
  return r.state;
}

/** View and legal moves of `seat`. */
export function seen(s: GameState, seat: Seat): { view: PlayerView; legal: LegalActions } {
  return { view: playerView(s, seat), legal: legalActions(s, seat) };
}

/** First edge touching vertex `v`. */
export function edgeAt(v: number): number {
  return STANDARD_TOPOLOGY.vertices[v]!.edges[0]!;
}
