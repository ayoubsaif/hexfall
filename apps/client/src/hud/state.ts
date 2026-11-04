// Small selectors over the game store, shared by HUD components.
import type { PlayerSummary } from "@hexfall/engine";
import { useConnectionStore } from "../store/connection.ts";
import { useGameStore } from "../store/game.ts";

export const useView = () => useGameStore((s) => s.view);
export const useLegal = () => useGameStore((s) => s.legal);
/**
 * True while no action can be sent: one is already in flight, or the connection is not
 * open (reconnecting, replaced). Action controls are disabled while it holds.
 */
export function useInFlight(): boolean {
  const inFlight = useGameStore((s) => s.inFlight);
  const open = useConnectionStore((s) => s.status === "open");
  return inFlight || !open;
}

/** The viewer's own player summary (with hand contents), or null. */
export function useOwn(): PlayerSummary | null {
  return useGameStore((s) => {
    const v = s.view;
    if (!v || v.viewer === null) return null;
    return v.players[v.viewer] ?? null;
  });
}
