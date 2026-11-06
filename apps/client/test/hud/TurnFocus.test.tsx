// Your-turn focus (tasks 6.1, 6.2; game-hud "Your-turn focus").
import { act } from "react";
import { createGame } from "@hexfall/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DiceTray } from "../../src/hud/dice/DiceTray.tsx";
import { TITLE_MARK, TurnFocus } from "../../src/hud/TurnFocus.tsx";
import { useTurnFocus } from "../../src/hud/useTurnFocus.ts";
import { localNow } from "../../src/hud/countdown.ts";
import { useUiStore } from "../../src/store/ui.ts";
import { playState } from "../game/fixtures.ts";
import { mount, recordSession, resetAll, seatRoom, showGame, type Mounted } from "./helpers.tsx";

let m: Mounted;

beforeEach(() => {
  resetAll();
  recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setHidden(false);
});

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
}

const focus = () => useUiStore.getState().focus;
const q = <T extends Element = HTMLElement>(sel: string) => m.container.querySelector<T>(sel);
const overlay = () => q('[data-testid="turn-focus"]')!;
const dice = () => q<HTMLButtonElement>('[data-testid="dice"]')!;
const tray = () => q('[data-testid="dice-tray"]')!;
const rollTimer = (seats = [0], remainingMs = 30_000) => ({
  timer: { kind: "roll" as const, durationMs: 30_000, remainingMs, seats },
  timerAt: localNow(),
});

function Probe() {
  useTurnFocus();
  return null;
}

describe("useTurnFocus", () => {
  it("opens when the viewer's roll becomes legal", () => {
    seatRoom(0);
    showGame(playState({ seat: 1, rolled: false }), 0);
    m = mount(<Probe />);
    expect(focus()).toBe("closed");
    showGame(playState({ seat: 0, rolled: false }), 0, { source: "update" });
    expect(focus()).toBe("open");
  });

  it("opens on the first view after a resume", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<Probe />);
    expect(focus()).toBe("open");
  });

  it("opens for the roll for order", () => {
    seatRoom(0);
    showGame(createGame({ seed: 1, playerCount: 4, mode: "beginner" }), 0);
    m = mount(<Probe />);
    expect(focus()).toBe("open");
  });

  it("does not reopen after a dismissal within the same wait", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<Probe />);
    act(() => useUiStore.setState({ focus: "dismissed" }));
    showGame(playState({ seat: 0, rolled: false }), 0, { source: "update" });
    expect(focus()).toBe("dismissed");
  });

  it("a dismissed focus resets once the roll leaves the legal set, and opens next turn", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<Probe />);
    act(() => useUiStore.setState({ focus: "dismissed" }));
    showGame(playState({ seat: 0, rolled: true }), 0, { source: "update" });
    expect(focus()).toBe("closed");
    showGame(playState({ seat: 1, rolled: false }), 0, { source: "update" });
    showGame(playState({ seat: 0, rolled: false }), 0, { source: "update" });
    expect(focus()).toBe("open");
  });

  it("an open focus left without a roll (Knight before the roll) closes at once", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<Probe />);
    const s = playState({ seat: 0, rolled: false });
    s.phase = { kind: "moveRobber", source: "knight" };
    showGame(s, 0, {
      source: "update",
      lastEvents: [{ type: "devCardPlayed", seat: 0, card: "knight" }],
    });
    expect(focus()).toBe("closed");
    // Back to the roll after the robber move: the focus opens again.
    showGame(playState({ seat: 0, rolled: false }), 0, { source: "update" });
    expect(focus()).toBe("open");
  });

  it("closes as soon as the viewer's roll arrives (spec board-dice: Focus closes before the throw)", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<Probe />);
    showGame(playState({ seat: 0, rolled: true }), 0, {
      source: "update",
      lastEvents: [{ type: "diceRolled", seat: 0, dice: [2, 2], total: 4 }],
    });
    expect(focus()).toBe("closed");
  });
});

describe("TurnFocus", () => {
  it("Turn starts: dims, centers the dice with Your turn and the countdown, focuses the dice", () => {
    seatRoom(0);
    showGame(playState({ seat: 3 }), 0);
    m = mount(
      <>
        <DiceTray />
        <TurnFocus />
      </>,
    );
    expect(overlay().hasAttribute("data-open")).toBe(false);
    expect(q('[role="alert"]')).toBeNull();

    showGame(playState({ seat: 0, rolled: false }), 0, { source: "update", ...rollTimer() });
    expect(overlay().hasAttribute("data-open")).toBe(true);
    expect(overlay().className).toContain("z-30");
    expect(overlay().className).toContain("motion-reduce:transition-none");
    expect(q("h2")?.textContent).toBe("Your turn");
    expect(q('[role="alert"]')?.textContent).toBe("Your turn");
    expect(q('[data-testid="focus-countdown"]')?.textContent).toContain("30 seconds left");
    expect(q('[data-testid="focus-countdown"]')?.hasAttribute("data-warning")).toBe(false);
    expect(tray().hasAttribute("data-centered")).toBe(true);
    expect(tray().className).toContain("z-40");
    expect(tray().className).toContain("[--die:88px]");
    expect(document.activeElement).toBe(dice());
  });

  it("shows the countdown in the warning color in the last 10 seconds", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0, rollTimer([0], 9_000));
    m = mount(<TurnFocus />);
    const cd = q('[data-testid="focus-countdown"]')!;
    expect(cd.textContent).toContain("9 seconds left");
    expect(cd.hasAttribute("data-warning")).toBe(true);
  });

  it("no countdown without a timer; Roll for order heading", () => {
    seatRoom(0);
    showGame(createGame({ seed: 1, playerCount: 4, mode: "beginner" }), 0);
    m = mount(<TurnFocus />);
    expect(q("h2")?.textContent).toBe("Roll for order");
    expect(q('[data-testid="focus-countdown"]')).toBeNull();
  });

  it("Dismiss to look at the board: Escape closes, dice dock, still Roll dice", () => {
    seatRoom(0);
    const before = document.createElement("button");
    document.body.append(before);
    before.focus();
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(
      <>
        <DiceTray />
        <TurnFocus />
      </>,
    );
    expect(document.activeElement).toBe(dice());
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(focus()).toBe("dismissed");
    expect(overlay().hasAttribute("data-open")).toBe(false);
    expect(tray().hasAttribute("data-centered")).toBe(false);
    expect(dice().getAttribute("aria-label")).toBe("Roll dice");
    expect(dice().disabled).toBe(false);
    expect(dice().hasAttribute("data-ready")).toBe(true);
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it("a backdrop click or Not yet dismisses; a click inside does not", () => {
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<TurnFocus />);
    act(() => q("h2")!.click());
    expect(focus()).toBe("open");
    act(() => overlay().click());
    expect(focus()).toBe("dismissed");

    act(() => useUiStore.setState({ focus: "open" }));
    const notYet = [...m.container.querySelectorAll("button")].find(
      (b) => b.textContent === "Not yet",
    )!;
    act(() => notYet.click());
    expect(focus()).toBe("dismissed");
  });

  it("Background tab: marks the title while hidden, until the tab is shown", () => {
    document.title = "Hexfall";
    setHidden(true);
    seatRoom(0);
    showGame(playState({ seat: 1, rolled: false }), 0);
    m = mount(<TurnFocus />);
    expect(document.title).toBe("Hexfall");
    showGame(playState({ seat: 0, rolled: false }), 0, { source: "update" });
    expect(document.title).toBe(`${TITLE_MARK}Hexfall`);
    // Still hidden: another visibility event keeps the mark (no double prefix).
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(document.title).toBe(`${TITLE_MARK}Hexfall`);
    setHidden(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(document.title).toBe("Hexfall");
  });

  it("a visible tab is never marked", () => {
    document.title = "Hexfall";
    seatRoom(0);
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<TurnFocus />);
    expect(focus()).toBe("open");
    expect(document.title).toBe("Hexfall");
  });
});
