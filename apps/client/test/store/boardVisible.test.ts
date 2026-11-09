import { describe, expect, it } from "vite-plus/test";
import { boardVisible } from "../../src/store/room.ts";

describe("boardVisible", () => {
  const base = { room: "ABCDEF", status: "lobby" as const, pending: null };

  it("keeps the 3D board unloaded on the start screen", () => {
    expect(boardVisible({ room: null, status: null, pending: null })).toBe(false);
  });

  it("keeps the 3D board unloaded in the lobby", () => {
    expect(boardVisible(base)).toBe(false);
    expect(boardVisible({ ...base, pending: "leave" })).toBe(false);
  });

  it("loads the board as soon as the host clicks Start", () => {
    expect(boardVisible({ ...base, pending: "start" })).toBe(true);
  });

  it("shows the board once the game runs, is paused or ended", () => {
    for (const status of ["playing", "paused", "ended"] as const) {
      expect(boardVisible({ ...base, status })).toBe(true);
    }
  });
});
