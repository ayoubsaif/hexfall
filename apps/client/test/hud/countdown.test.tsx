// useCountdown (openspec floating-hud-turn-timer, task 4.1).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  type Countdown,
  countdownAt,
  countdownText,
  useCountdown,
} from "../../src/hud/countdown.ts";
import { resetGame, useGameStore } from "../../src/store/game.ts";
import { fixedT } from "../../src/i18n/index.ts";

const tEn = fixedT("en");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let seen: (Countdown | null)[] = [];

function Probe() {
  seen.push(useCountdown());
  return null;
}

const timer = (remainingMs: number, durationMs = 30_000) => ({
  kind: "roll" as const,
  durationMs,
  remainingMs,
  seats: [1],
});

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
  });
  resetGame();
  seen = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const last = () => seen[seen.length - 1] ?? null;

describe("countdownAt", () => {
  it("returns null without a timer", () => {
    expect(countdownAt(null, 0, 1000)).toBeNull();
  });

  it("rounds up to whole seconds and never goes negative", () => {
    expect(countdownAt(timer(12_400), 0, 0)?.secondsLeft).toBe(13);
    expect(countdownAt(timer(12_400), 0, 13_000)?.secondsLeft).toBe(0);
  });

  it("warns at 10 seconds and steps the fraction with the seconds", () => {
    const c = countdownAt(timer(10_000), 0, 0);
    expect(c?.warning).toBe(true);
    expect(c?.fraction).toBeCloseTo(10 / 30);
    expect(countdownAt(timer(11_000), 0, 0)?.warning).toBe(false);
  });

  it("formats the text", () => {
    expect(countdownText(38, tEn)).toBe("38 seconds left");
    expect(countdownText(1, tEn)).toBe("1 second left");
  });
});

describe("useCountdown", () => {
  it("gives null when the timer is off", () => {
    act(() => root.render(<Probe />));
    expect(last()).toBeNull();
  });

  it("updates once per second", () => {
    const at = performance.now();
    act(() => useGameStore.setState({ timer: timer(5_000), timerAt: at }));
    act(() => root.render(<Probe />));
    expect(last()?.secondsLeft).toBe(5);
    const before = seen.length;
    void act(() => vi.advanceTimersByTime(1_000));
    expect(last()?.secondsLeft).toBe(4);
    void act(() => vi.advanceTimersByTime(1_000));
    expect(last()?.secondsLeft).toBe(3);
    // Two ticks, two renders: nothing in between.
    expect(seen.length - before).toBe(2);
  });

  it("stops at zero", () => {
    act(() => useGameStore.setState({ timer: timer(2_000), timerAt: performance.now() }));
    act(() => root.render(<Probe />));
    void act(() => vi.advanceTimersByTime(5_000));
    expect(last()?.secondsLeft).toBe(0);
    const n = seen.length;
    void act(() => vi.advanceTimersByTime(5_000));
    expect(seen.length).toBe(n);
  });

  it("resets when a new message arrives", () => {
    act(() => useGameStore.setState({ timer: timer(3_000), timerAt: performance.now() }));
    act(() => root.render(<Probe />));
    void act(() => vi.advanceTimersByTime(2_000));
    expect(last()?.secondsLeft).toBe(1);
    act(() => useGameStore.setState({ timer: timer(90_000, 90_000), timerAt: performance.now() }));
    expect(last()?.secondsLeft).toBe(90);
    expect(last()?.warning).toBe(false);
  });
});
