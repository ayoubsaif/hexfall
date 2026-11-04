import { describe, expect, it } from "vite-plus/test";
import {
  BOARD_STYLE_STORAGE_KEY,
  type StyleStorage,
  readStoredStyle,
  resolveInitialStyle,
  writeStoredStyle,
} from "../../src/theme/style.ts";

function memoryStorage(): StyleStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwing: StyleStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("resolveInitialStyle", () => {
  it("a valid stored value wins over the device", () => {
    expect(resolveInitialStyle({ stored: "3d", coarsePointer: true, smallScreen: true })).toBe(
      "3d",
    );
    expect(resolveInitialStyle({ stored: "flat", coarsePointer: false, smallScreen: false })).toBe(
      "flat",
    );
  });

  it.each<[unknown, boolean, boolean, string]>([
    [null, true, false, "flat"],
    [null, false, true, "flat"],
    [null, true, true, "flat"],
    [null, false, false, "3d"],
    ["bogus", false, false, "3d"],
    ["bogus", true, false, "flat"],
    [undefined, false, false, "3d"],
  ])("stored %j, coarse %s, small %s -> %s", (stored, coarsePointer, smallScreen, expected) => {
    expect(resolveInitialStyle({ stored, coarsePointer, smallScreen })).toBe(expected);
  });
});

describe("style persistence", () => {
  it("writes and reads back under hexfall.boardStyle", () => {
    const storage = memoryStorage();
    expect(BOARD_STYLE_STORAGE_KEY).toBe("hexfall.boardStyle");
    expect(writeStoredStyle("flat", storage)).toBe(true);
    expect(storage.data["hexfall.boardStyle"]).toBe("flat");
    expect(readStoredStyle(storage)).toBe("flat");
  });

  it("reads nothing when storage is empty or missing", () => {
    expect(readStoredStyle(memoryStorage())).toBeNull();
    expect(readStoredStyle(null)).toBeNull();
    expect(writeStoredStyle("3d", null)).toBe(false);
  });

  it("survives storage that throws on read and write", () => {
    expect(readStoredStyle(throwing)).toBeNull();
    expect(writeStoredStyle("3d", throwing)).toBe(false);
    const stored = readStoredStyle(throwing);
    expect(resolveInitialStyle({ stored, coarsePointer: false, smallScreen: false })).toBe("3d");
  });
});
