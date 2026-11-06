// specs/keyboard-shortcuts "Shortcut registry", "Key handling guards".
import { describe, expect, it } from "vite-plus/test";
import { ignoreKey } from "../../src/hotkeys/guards.ts";
import { HOTKEYS, hotkeyLabel, keyLabel, matchHotkey } from "../../src/hotkeys/registry.ts";
import { nextView } from "../../src/hotkeys/useHotkeys.ts";

function key(init: KeyboardEventInit & { target?: HTMLElement }) {
  const e = new KeyboardEvent("keydown", { bubbles: true, ...init });
  if (init.target) Object.defineProperty(e, "target", { value: init.target });
  return e;
}

describe("registry", () => {
  it("has no duplicate keys or ids", () => {
    const keys = HOTKEYS.flatMap((h) => h.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(HOTKEYS.map((h) => h.id)).size).toBe(HOTKEYS.length);
  });
  it("matches case-insensitively and by character", () => {
    expect(matchHotkey("E")?.id).toBe("endTurn");
    expect(matchHotkey("e")?.id).toBe("endTurn");
    expect(matchHotkey("Enter")?.id).toBe("endTurn");
    expect(matchHotkey(" ")?.id).toBe("rollDice");
    expect(matchHotkey("+")?.id).toBe("zoomIn");
    expect(matchHotkey("=")?.id).toBe("zoomIn");
    expect(matchHotkey("?")?.id).toBe("showHotkeys");
    expect(matchHotkey("x")).toBeNull();
  });
  it("labels keys", () => {
    expect(keyLabel(" ")).toBe("Space");
    expect(hotkeyLabel("endTurn")).toBe("E");
    expect(hotkeyLabel("rollDice")).toBe("Space");
  });
  it("cycles views free, top, diagonal", () => {
    expect(nextView("free")).toBe("top");
    expect(nextView("top")).toBe("diagonal");
    expect(nextView("diagonal")).toBe("free");
  });
});

describe("ignoreKey", () => {
  it("ignores repeats and modifiers", () => {
    expect(ignoreKey(key({ key: "e", repeat: true }))).toBe(true);
    expect(ignoreKey(key({ key: "r", ctrlKey: true }))).toBe(true);
    expect(ignoreKey(key({ key: "r", metaKey: true }))).toBe(true);
    expect(ignoreKey(key({ key: "r", altKey: true }))).toBe(true);
    expect(ignoreKey(key({ key: "r" }))).toBe(false);
  });
  it("ignores typing targets", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(ignoreKey(key({ key: "d", target: document.createElement(tag) }))).toBe(true);
    }
  });
  it("leaves Enter and Space to a focused button", () => {
    const b = document.createElement("button");
    expect(ignoreKey(key({ key: "Enter", target: b }))).toBe(true);
    expect(ignoreKey(key({ key: " ", target: b }))).toBe(true);
    expect(ignoreKey(key({ key: "e", target: b }))).toBe(false);
  });
});
