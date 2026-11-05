// What the game is waiting on the viewer for (openspec change turn-sound-and-push).
// The kinds and rules are shared with the server's push payloads (@hexfall/protocol push.ts).
import type { LegalActions, PlayerView } from "@hexfall/engine";
import { waitKindOf, type WaitKind } from "@hexfall/protocol";

export type { WaitKind };

/** The viewer's current wait, or null when the game is not waiting on them (or is over). */
export function viewerWait(view: PlayerView | null, legal: LegalActions | null): WaitKind | null {
  if (!view) return null;
  return waitKindOf(legal, view.winner !== null);
}
