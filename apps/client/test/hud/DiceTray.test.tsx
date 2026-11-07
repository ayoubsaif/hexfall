// Dice tray centered mode, settle callback and roll countdown (task 6.3; game-hud "Dice
// display", "Your-turn focus", "Turn countdown").
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DiceTray, THROW_MS } from "../../src/hud/dice/DiceTray.tsx";
import { TurnFocus } from "../../src/hud/TurnFocus.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { useDiceStore } from "../../src/store/dice.ts";
import { localNow } from "../../src/hud/countdown.ts";
import { setDiceDock, DEFAULT_DOCK } from "../../src/store/dock.ts";
import { useUiStore } from "../../src/store/ui.ts";
import { playState } from "../game/fixtures.ts";
import {
  actions,
  click,
  mount,
  recordSession,
  resetAll,
  seatRoom,
  showGame,
  type Call,
  type Mounted,
} from "./helpers.tsx";

let m: Mounted;
let calls: Call[];

beforeEach(() => {
  resetAll();
  calls = recordSession();
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
});
afterEach(() => {
  m?.unmount();
  resetAll();
  act(() => setDiceDock(DEFAULT_DOCK));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const focus = () => useUiStore.getState().focus;
const q = <T extends Element = HTMLElement>(sel: string) => m.container.querySelector<T>(sel);
const dice = () => q<HTMLButtonElement>('[data-testid="dice"]')!;
const tray = () => q('[data-testid="dice-tray"]')!;
const rollTimer = (seats = [0], remainingMs = 30_000) => ({
  timer: { kind: "roll" as const, durationMs: 30_000, remainingMs, seats },
  timerAt: localNow(),
});

function withFocus() {
  return mount(
    <>
      <DiceTray />
      <TurnFocus />
    </>,
  );
}

/** The server's answer to a roll by or for seat 0: the roll event and the rolled view. */
function rolledUpdate(): void {
  showGame(playState({ seat: 0, rolled: true }), 0, {
    source: "update",
    log: [{ type: "diceRolled", seat: 0, dice: [2, 4], total: 6 }],
    lastEvents: [{ type: "diceRolled", seat: 0, dice: [2, 4], total: 6 }],
  });
}

describe("DiceTray centered mode", () => {
  it("Roll from the focus: sends once, closes at once so the board throw is seen, docks again", () => {
    seatRoom(0);
    act(() => setDiceDock({ right: 342, bottom: 260 }));
    showGame(playState({ seat: 0, rolled: false }), 0, { log: [] });
    m = withFocus();
    const el = tray();
    expect(focus()).toBe("open");
    expect(el.hasAttribute("data-centered")).toBe(true);
    expect(el.className).toContain("fixed");
    expect(el.style.right).toBe("");

    click(dice());
    expect(actions(calls)).toEqual([{ type: "rollDice" }]);

    rolledUpdate();
    // The dice are thrown on the board: the dimming focus closes right away.
    expect(focus()).toBe("closed");
    expect(q("[data-rolling]")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(THROW_MS + 300);
    });
    expect(tray()).toBe(el); // same element in both modes
    expect(el.hasAttribute("data-centered")).toBe(false);
    expect(el.style.right).toBe("342px");
    expect(el.style.bottom).toBe("260px");
    expect(q('[data-testid="dice-announce"]')?.textContent).toContain("total 6");
    // Rolled: no roll left to make, so the tray is not drawn (the board dice show the values).
    expect(el.hasAttribute("data-shown")).toBe(false);
    expect(actions(calls)).toHaveLength(1);
  });

  it("a timer-driven roll closes the focus the same way", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0, { log: [], ...rollTimer() });
    m = withFocus();
    expect(focus()).toBe("open");
    rolledUpdate();
    expect(focus()).toBe("closed");
    expect(actions(calls)).toEqual([]);
  });

  it("closes at once under reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q }));
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0, { log: [] });
    m = withFocus();
    rolledUpdate();
    expect(m.container.querySelector("[data-rolling]")).toBeNull();
    expect(focus()).toBe("closed");
  });

  it("another seat's roll never reports a settle for the viewer", () => {
    const onSettled = vi.fn();
    seatRoom(2);
    showGame(playState({ seat: 0, rolled: false }), 2, { log: [] });
    m = mount(<DiceTray onSettled={onSettled} />);
    showGame(playState({ seat: 0, rolled: true }), 2, {
      source: "update",
      log: [{ type: "diceRolled", seat: 0, dice: [1, 1], total: 2 }],
    });
    act(() => {
      vi.advanceTimersByTime(THROW_MS + 300);
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled.mock.calls[0]?.[0]).toMatchObject({ seat: 0, dice: [1, 1] });
    expect(onSettled.mock.calls[0]?.[1]).toBe(2);
    expect(focus()).toBe("closed");
  });

  it("a roll already in the snapshot does not report a settle", () => {
    const onSettled = vi.fn();
    seatRoom(0);
    showGame(playState({ seat: 0 }), 0, {
      log: [{ type: "diceRolled", seat: 0, dice: [3, 4], total: 7 }],
    });
    m = mount(<DiceTray onSettled={onSettled} />);
    expect(onSettled).not.toHaveBeenCalled();
  });
});

describe("no actions while the dice roll (pace-bots-and-dice)", () => {
  const endTurn = () =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      (b.getAttribute("aria-label") ?? b.textContent ?? "").includes("End turn"),
    )!;

  it("blocks the viewer's controls until the throw ends", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0, { log: [] });
    m = mount(
      <>
        <DiceTray />
        <ActionButtons />
      </>,
    );
    rolledUpdate();
    expect(useDiceStore.getState().rolling).toBe(true);
    expect(endTurn().disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(THROW_MS + 300);
    });
    expect(useDiceStore.getState().rolling).toBe(false);
    expect(endTurn().disabled).toBe(false);
  });

  it("never blocks for a roll already in the snapshot", () => {
    seatRoom(0);
    showGame(playState({ seat: 0 }), 0, {
      log: [{ type: "diceRolled", seat: 0, dice: [3, 4], total: 7 }],
    });
    m = mount(<DiceTray />);
    expect(useDiceStore.getState().rolling).toBe(false);
  });

  it("clears the block when the tray unmounts mid-throw", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0, { log: [] });
    m = mount(<DiceTray />);
    rolledUpdate();
    expect(useDiceStore.getState().rolling).toBe(true);
    m.unmount();
    expect(useDiceStore.getState().rolling).toBe(false);
  });
});

describe("DiceTray roll countdown", () => {
  it("shows the viewer's roll countdown on the docked dice", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0, rollTimer([0], 25_000));
    m = mount(<DiceTray />); // no focus mounted: the dice stay docked
    const cd = q('[data-testid="dice-countdown"]')!;
    expect(cd.textContent).toContain("25 seconds left");
    expect(cd.hasAttribute("data-warning")).toBe(false);
    expect(dice().getAttribute("aria-describedby")).toBe("dice-countdown");
    act(() => {
      vi.advanceTimersByTime(16_000);
    });
    expect(cd.textContent).toContain("9 seconds left");
    expect(cd.hasAttribute("data-warning")).toBe(true);
  });

  it("is on the focus, not the dice, while the focus is open", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0, rollTimer());
    m = withFocus();
    expect(focus()).toBe("open");
    expect(q('[data-testid="dice-countdown"]')).toBeNull();
    expect(q('[data-testid="focus-countdown"]')).not.toBeNull();
    act(() => useUiStore.setState({ focus: "dismissed" }));
    expect(q('[data-testid="dice-countdown"]')?.textContent).toContain("30 seconds left");
  });

  it("is not shown for another seat's roll or without a timer", () => {
    seatRoom(2);
    showGame(playState({ seat: 0, rolled: false }), 2, rollTimer([0]));
    m = mount(<DiceTray />);
    expect(q('[data-testid="dice-countdown"]')).toBeNull();
    m.unmount();
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0, { timer: null });
    m = mount(<DiceTray />);
    expect(q('[data-testid="dice-countdown"]')).toBeNull();
  });
});
