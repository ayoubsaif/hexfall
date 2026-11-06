// Splash screen (openspec settlecoast-parchment-ui, "Splash screen").
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Splash, TIP_COUNT, TIP_INTERVAL_MS } from "../../src/hud/Splash.tsx";
import { DEFAULT_PREFS, usePrefsStore } from "../../src/store/prefs.ts";
import { click, mount, resetAll, type Mounted } from "./helpers.tsx";

let m: Mounted;
const count = () => m.container.querySelector("[data-testid=splash-count]")?.textContent;
const tip = () => m.container.querySelector("[data-testid=splash-tip]")?.textContent;
const btn = (label: RegExp) =>
  [...m.container.querySelectorAll("button")].find((b) =>
    label.test(b.getAttribute("aria-label") ?? ""),
  );

beforeEach(() => {
  vi.useFakeTimers();
  resetAll();
  usePrefsStore.setState({ ...DEFAULT_PREFS, motion: "full" });
  m = mount(<Splash />);
});
afterEach(() => {
  m.unmount();
  vi.useRealTimers();
  resetAll();
});

describe("Splash", () => {
  it("shows the title, a progress bar and the first tip", () => {
    expect(m.container.textContent).toContain("Hexfall");
    expect(m.container.querySelector("[role=progressbar]")).not.toBeNull();
    expect(count()).toBe(`1 / ${TIP_COUNT}`);
  });

  it("rotates the tip every 6 seconds", () => {
    const first = tip();
    act(() => void vi.advanceTimersByTime(TIP_INTERVAL_MS));
    expect(count()).toBe(`2 / ${TIP_COUNT}`);
    expect(tip()).not.toBe(first);
  });

  it("pause stops rotation and next advances", () => {
    click(btn(/pause/i));
    act(() => void vi.advanceTimersByTime(TIP_INTERVAL_MS * 3));
    expect(count()).toBe(`1 / ${TIP_COUNT}`);
    expect(btn(/resume/i)?.getAttribute("aria-pressed")).toBe("true");
    click(btn(/next/i));
    expect(count()).toBe(`2 / ${TIP_COUNT}`);
  });

  it("does not auto-rotate with reduced motion", () => {
    act(() => usePrefsStore.setState({ motion: "reduce" }));
    act(() => void vi.advanceTimersByTime(TIP_INTERVAL_MS * 2));
    expect(count()).toBe(`1 / ${TIP_COUNT}`);
  });
});
