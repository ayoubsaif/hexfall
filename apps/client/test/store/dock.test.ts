// Dice dock and floating HUD layout (store/dock.ts; openspec floating-hud-turn-timer task 5.6,
// design decision 9).
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_DOCK,
  HUD_GAP,
  hudLayout,
  setDiceDock,
  useDockStore,
} from "../../src/store/dock.ts";

afterEach(() => setDiceDock(DEFAULT_DOCK));

describe("setDiceDock", () => {
  it("stores the dock and ignores repeats", () => {
    let changes = 0;
    const off = useDockStore.subscribe(() => changes++);
    setDiceDock({ right: 342, bottom: 260 });
    setDiceDock({ right: 342, bottom: 260 });
    off();
    expect(useDockStore.getState()).toEqual({ right: 342, bottom: 260 });
    expect(changes).toBe(1);
  });
});

describe("hudLayout", () => {
  it("desktop 1440 × 900: dice left of the side log, above the buttons; pill above the hand", () => {
    // Hand 98 px tall; buttons in a row above it (bottom 110, 56 px tall); log 300 px wide.
    const l = hudLayout({
      width: 1440,
      height: 900,
      handHeight: 98,
      cluster: { left: 1092, top: 900 - 110 - 56 },
      aside: { left: 1128, width: 300 },
      cornerHeight: 0,
    });
    expect(l.dock).toEqual({ right: 312 + HUD_GAP, bottom: 166 + HUD_GAP });
    expect(l.hudBottom).toBe(166);
    expect(l.pillBottom).toBe(98 + HUD_GAP);
    // The pill sits level with the buttons, so it keeps clear of them on both sides.
    expect(l.pillSide).toBe(1440 - 1092 + 8);
  });

  it("phone 360 × 740: dice left of the button column, above the raised hand", () => {
    // Column 44 px wide at right 8, from bottom 82 up to 382; corner controls 84 px tall.
    const l = hudLayout({
      width: 360,
      height: 740,
      handHeight: 70,
      cluster: { left: 308, top: 740 - 382 },
      aside: { left: 360, width: 0 },
      cornerHeight: 84,
    });
    expect(l.dock).toEqual({ right: 52 + HUD_GAP, bottom: 70 + HUD_GAP });
    // Pill above the dice and the corner controls, narrowed to clear the column.
    expect(l.pillBottom).toBe(70 + HUD_GAP + 84 + 8);
    expect(l.pillSide).toBe(52 + 8);
    expect(l.hudBottom).toBe(382);
  });

  it("short landscape 900 × 500: no side log, dice left of the button row", () => {
    const l = hudLayout({
      width: 900,
      height: 500,
      handHeight: 70,
      cluster: { left: 590, top: 500 - 82 - 48 },
      aside: null,
      cornerHeight: 84,
    });
    expect(l.dock).toEqual({ right: 310 + HUD_GAP, bottom: 70 + HUD_GAP });
    // The pill clears the top of the row, so it may use the full width.
    expect(l.pillBottom).toBe(70 + HUD_GAP + 84 + 8);
    expect(l.pillSide).toBe(HUD_GAP);
  });

  it("tablet 768 × 1024 with no buttons shown (another player's turn)", () => {
    const l = hudLayout({
      width: 768,
      height: 1024,
      handHeight: 98,
      cluster: { left: 756, top: 1024 - 110 },
      aside: null,
      cornerHeight: 80,
    });
    expect(l.dock).toEqual({ right: 12 + HUD_GAP, bottom: 98 + HUD_GAP });
    // Dice 78 px tall here (not compact); the corner controls are shorter.
    expect(l.pillBottom).toBe(98 + HUD_GAP + 80 + 8);
  });

  it("no hand (spectator): everything drops to the bottom gap", () => {
    const l = hudLayout({
      width: 1440,
      height: 900,
      handHeight: 0,
      cluster: { left: 1428, top: 900 - 12 },
      aside: { left: 1128, width: 300 },
      cornerHeight: 0,
    });
    expect(l.dock).toEqual({ right: 312 + HUD_GAP, bottom: 12 + HUD_GAP });
    expect(l.pillBottom).toBe(HUD_GAP);
  });
});
