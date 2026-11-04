// Redacted per-seat view (AGENTS.md §13.15, design.md decision 8). Owner: cards agent.
import { cardTotal, hiddenVp, publicVp } from "./rules/common.ts";
import type { GameEvent, GameState, PlayerSummary, PlayerView, Seat } from "./state.ts";

function copy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function redact(e: GameEvent, viewer: Seat | null, ended: boolean): GameEvent {
  if (ended) return copy(e);
  if (e.type === "stole" && viewer !== e.thief && viewer !== e.victim) {
    return { ...e, resource: null };
  }
  if (e.type === "devCardBought" && viewer !== e.seat) {
    return { ...e, card: null };
  }
  return copy(e);
}

/** View for seat (null = spectator). Never exposes the RNG, deck order or others' hands. */
export function playerView(s: GameState, seat: Seat | null): PlayerView {
  const ended = s.phase.kind === "ended";
  const viewer = seat !== null && Number.isInteger(seat) && s.players[seat] ? seat : null;
  const players = s.players.map((p, i): PlayerSummary => {
    const summary: PlayerSummary = {
      seat: i,
      resourceCount: cardTotal(p.resources),
      devCardCount: p.devCards.length,
      knights: p.knights,
      revealedVp: p.revealedVp,
      publicVp: publicVp(s, i),
      pieces: { ...p.pieces },
    };
    if (ended || i === viewer) {
      summary.resources = { ...p.resources };
      summary.devCards = [...p.devCards];
      summary.boughtThisTurn = [...p.boughtThisTurn];
      summary.hiddenVp = hiddenVp(s, i);
    }
    return summary;
  });
  return {
    viewer,
    playerCount: s.playerCount,
    mode: s.mode,
    board: copy(s.board),
    robber: s.robber,
    vertices: copy(s.vertices),
    edges: [...s.edges],
    bank: { ...s.bank },
    devDeckCount: s.devDeck.length,
    players,
    phase: copy(s.phase),
    turn: copy(s.turn),
    longestRoad: s.longestRoad,
    largestArmy: s.largestArmy,
    offers: copy(s.offers),
    winner: s.winner,
    log: s.log.map((e) => redact(e, viewer, ended)),
  };
}
