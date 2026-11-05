import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  installMotionAttribute,
  prefersReducedMotion,
  resetMotionAttributeForTests,
  resolveReducedMotion,
} from "../../src/store/motion.ts";
import { DEFAULT_PREFS, setPref, usePrefsStore } from "../../src/store/prefs.ts";

function mockMedia(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => usePrefsStore.setState({ ...DEFAULT_PREFS }));
afterEach(() => {
  vi.unstubAllGlobals();
  resetMotionAttributeForTests();
});

describe("motion preference (specs/client-settings 'Motion preference')", () => {
  it.each([
    ["system", false, false],
    ["system", true, true],
    ["reduce", false, true],
    ["reduce", true, true],
    ["full", false, false],
    ["full", true, false],
  ] as const)("%s with OS reduce=%s → reduced %s", (pref, os, expected) => {
    expect(resolveReducedMotion(pref, os)).toBe(expected);
  });

  it("reads the stored choice and the media query", () => {
    mockMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    usePrefsStore.setState({ motion: "full" });
    expect(prefersReducedMotion()).toBe(false);
    mockMedia(false);
    usePrefsStore.setState({ motion: "reduce" });
    expect(prefersReducedMotion()).toBe(true);
  });

  it("mirrors the choice to <html data-motion>", () => {
    const root = document.createElement("html");
    installMotionAttribute(root);
    expect(root.dataset.motion).toBe("system");
    setPref("motion", "reduce");
    expect(root.dataset.motion).toBe("reduce");
  });
});
