// Log drawer with Log and Dice tabs (openspec log-drawer-dice-stats; specs/game-hud "Log drawer
// tabs", "Dice statistics"; specs/hud-presentation "Responsive HUD layout").
import type { GameEvent } from "@hexfall/engine";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DiceStats } from "../../src/hud/DiceStats.tsx";
import { Hud } from "../../src/hud/Hud.tsx";
import { useGameStore } from "../../src/store/game.ts";
import { playState } from "../game/fixtures.ts";
import {
  byText,
  click,
  mount,
  recordSession,
  resetAll,
  seatRoom,
  showGame,
  type Mounted,
} from "./helpers.tsx";

let m: Mounted;

beforeEach(() => {
  resetAll();
  recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
});

const roll = (a: number, b: number): GameEvent => ({
  type: "diceRolled",
  seat: 0,
  dice: [a, b],
  total: a + b,
});

const setLog = (log: GameEvent[]) => act(() => useGameStore.setState({ log }));

/** Radix tabs select on mouse down (not click). */
function pick(el: Element | null | undefined): void {
  if (!el) throw new Error("no tab");
  act(() => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
}

const toggle = () => document.querySelector<HTMLElement>('[data-testid="log-button"]');
const tab = (name: string) => byText(document.body, '[role="tab"]', name);
const bars = () =>
  Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>('[data-testid="dice-bar"]')].map((b) => [
      Number(b.dataset.total),
      Number(b.dataset.count),
    ]),
  );

function openDrawer(): void {
  seatRoom(0);
  showGame(playState(), 0);
  m = mount(<Hud />);
  click(toggle());
}

describe("Log drawer", () => {
  it("shows no event log on the board, only the Log toggle", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<Hud />);
    expect(toggle()).toBeDefined();
    expect(
      document.querySelector('[data-testid="log-line"], [data-testid="log-empty"]'),
    ).toBeNull();
    expect(document.querySelector('[role="tablist"]')).toBeNull();
  });

  it("opens on the Log tab with the event log", () => {
    openDrawer();
    expect(tab("Log")?.getAttribute("aria-selected")).toBe("true");
    expect(tab("Dice")?.getAttribute("aria-selected")).toBe("false");
    const panel = document.querySelector('[role="tabpanel"]');
    expect(panel?.getAttribute("aria-labelledby")).toBe(tab("Log")?.id);
    expect(
      panel?.querySelector('[data-testid="log-line"], [data-testid="log-empty"]'),
    ).not.toBeNull();
  });

  it("switches to Dice and reopens on the last tab", () => {
    openDrawer();
    pick(tab("Dice"));
    expect(tab("Dice")?.getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector('[data-testid="dice-total"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="log-line"]')).toBeNull();
    // Close with Escape, then open again.
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(document.querySelector('[role="tablist"]')).toBeNull();
    click(toggle());
    expect(tab("Dice")?.getAttribute("aria-selected")).toBe("true");
  });
});

describe("DiceStats", () => {
  it("empty state before any turn roll; order rolls are not counted", () => {
    m = mount(<DiceStats />);
    setLog([{ type: "orderRolled", seat: 0, dice: [4, 5] }]);
    expect(document.querySelector('[data-testid="dice-empty"]')?.textContent).toBe("No rolls yet.");
    expect(document.querySelector('[data-testid="dice-total"]')?.textContent).toBe("0 rolls");
    expect(bars()).toEqual({});
  });

  it("counts each total, tallest bar for the most frequent, 7 in the warning color", () => {
    m = mount(<DiceStats />);
    setLog([roll(4, 4), roll(1, 5), roll(2, 6), roll(3, 4), roll(5, 6)]);
    expect(document.querySelector('[data-testid="dice-total"]')?.textContent).toBe("5 rolls");
    expect(bars()).toEqual({ 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 2, 9: 0, 10: 0, 11: 1, 12: 0 });
    const bar = (n: number) =>
      document.querySelector<HTMLElement>(`[data-testid="dice-bar"][data-total="${n}"]`)!;
    const fill = (n: number) => bar(n).querySelector<HTMLElement>("[style]")!;
    expect(fill(8).style.height).toBe("100%");
    expect(fill(6).style.height).toBe("50%");
    expect(fill(7).className).toContain("bg-bad");
    expect(fill(6).className).toContain("bg-primary");
    expect(bar(8).getAttribute("aria-label")).toBe("8: 2 times");
    expect(bar(6).getAttribute("aria-label")).toBe("6: 1 time");
  });

  it("updates live when a roll arrives", () => {
    m = mount(<DiceStats />);
    setLog([roll(2, 3)]);
    expect(bars()[5]).toBe(1);
    setLog([roll(2, 3), roll(1, 4)]);
    expect(bars()[5]).toBe(2);
    expect(document.querySelector('[data-testid="dice-total"]')?.textContent).toBe("2 rolls");
  });
});
