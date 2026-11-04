// Where the dice tray docks (specs/game-hud "Dice display"): its distance from the viewport's
// right and bottom edges. Hud.tsx measures the HUD (edge hand, floating buttons, side log) and
// `hudLayout` turns that into the dock and the CSS variables that place the side log and the
// status pill. The board itself stays a full-screen background and is never resized around it.
import { create } from "zustand";

export interface Dock {
  right: number;
  bottom: number;
}

export const DEFAULT_DOCK: Dock = { right: 12, bottom: 12 };

export const useDockStore = create<Dock>()(() => ({ ...DEFAULT_DOCK }));

/** Stores a new dice dock; a no-op when nothing changed. */
export function setDiceDock(next: Dock): void {
  const cur = useDockStore.getState();
  if (cur.right === next.right && cur.bottom === next.bottom) return;
  useDockStore.setState({ ...next }, true);
}

/** Gap between floating HUD pieces and between them and the screen edges. */
export const HUD_GAP = 12;

/** Docked dice tray heights (DiceTray: --die 36 px compact, 44 px otherwise, × ~1.7). */
const DICE_HEIGHT = { compact: 64, normal: 78 } as const;

/** Measurements of the HUD in viewport pixels. */
export interface HudMetrics {
  width: number;
  height: number;
  /** Full card height of the edge hand (a raised card reaches this high); 0 without a hand. */
  handHeight: number;
  /** The floating action button cluster's box. */
  cluster: { left: number; top: number };
  /** The side log's box, or null/zero width when the log is a drawer. */
  aside: { left: number; width: number } | null;
  /** Height of the board-style and credits controls when they sit above the hand (0 if not). */
  cornerHeight: number;
}

export interface HudLayout {
  dock: Dock;
  /** Viewport bottom to the top of the floating buttons or the raised hand (places the side log). */
  hudBottom: number;
  /** Status pill's distance from the viewport bottom. */
  pillBottom: number;
  /** Horizontal room the status pill leaves on each side (to clear the floating buttons). */
  pillSide: number;
}

/**
 * Lays out the floating HUD (design decision 9). The buttons sit at the bottom-right above the
 * raised hand, so a rising card never covers them.
 * - Desktop (side log visible): dice left of the side log, just above the buttons; the status
 *   pill just above the hand, clear of the buttons.
 * - Otherwise: dice left of the buttons, just above the raised hand; the status pill above the
 *   dice and the corner controls.
 */
export function hudLayout(m: HudMetrics): HudLayout {
  const desktop = m.width >= 1024 && m.height >= 600;
  const compact = m.width < 640 || m.height < 600;
  const hand = Math.ceil(m.handHeight);
  const clusterUp = Math.ceil(m.height - m.cluster.top);
  const clusterSide = Math.ceil(m.width - m.cluster.left);
  const aside = m.aside && m.aside.width > 0 ? m.aside : null;

  const dock: Dock =
    desktop && aside
      ? { right: Math.ceil(m.width - aside.left) + HUD_GAP, bottom: clusterUp + HUD_GAP }
      : { right: clusterSide + HUD_GAP, bottom: hand + HUD_GAP };

  const dice = compact ? DICE_HEIGHT.compact : DICE_HEIGHT.normal;
  const pillBottom =
    desktop && aside
      ? hand + HUD_GAP
      : hand + HUD_GAP + Math.max(dice, Math.ceil(m.cornerHeight)) + 8;
  // Below the top of the buttons the pill must stay clear of them on both sides (it is centered).
  const pillSide = pillBottom < clusterUp ? clusterSide + 8 : HUD_GAP;

  return { dock, hudBottom: Math.max(clusterUp, hand), pillBottom, pillSide };
}
