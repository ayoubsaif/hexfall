import type { GameEvent } from "@hexfall/engine";
import { beginnerBoard } from "@hexfall/engine/geometry";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DROP_HEIGHT,
  DROP_MS,
  GLOW_MS,
  ROBBER_MS,
  dropOffset,
  glowStrength,
  motionDurations,
  newPieceKeys,
  prefersReducedMotion,
  producingHexes,
  progress,
  robberPath,
  shouldTweenRobber,
} from "../../src/scene/motion.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("durations", () => {
  it("are within the spec limits and zero under reduced motion", () => {
    const d = motionDurations(false);
    expect(d.drop).toBe(DROP_MS);
    expect(d.drop).toBeLessThanOrEqual(400);
    expect(d.robber).toBe(ROBBER_MS);
    expect(d.robber).toBeLessThanOrEqual(600);
    expect(d.glow).toBe(GLOW_MS);
    expect(motionDurations(true)).toEqual({ drop: 0, robber: 0, glow: 0 });
  });

  it("a zero duration is finished at once", () => {
    expect(progress(0, 0)).toBe(1);
    expect(dropOffset(0, 0)).toBe(0);
    expect(robberPath([0, 0], [2, 1], 0, 0)).toEqual([2, 0, 1]);
    expect(glowStrength(0, 0)).toBe(0);
  });
});

describe("piece drop", () => {
  it("starts high and lands exactly at the end", () => {
    expect(dropOffset(0, DROP_MS)).toBeCloseTo(DROP_HEIGHT);
    expect(dropOffset(DROP_MS / 2, DROP_MS)).toBeLessThan(DROP_HEIGHT / 2);
    expect(dropOffset(DROP_MS, DROP_MS)).toBe(0);
    expect(dropOffset(DROP_MS * 3, DROP_MS)).toBe(0);
  });

  it("animates only pieces new in an update, never on first render or snapshot", () => {
    expect(newPieceKeys(null, ["e1", "v2:settlement"], "update")).toEqual(new Set());
    const prev = new Set(["e1"]);
    expect(newPieceKeys(prev, ["e1", "e2"], "snapshot")).toEqual(new Set());
    expect(newPieceKeys(prev, ["e1", "e2"], null)).toEqual(new Set());
    expect(newPieceKeys(prev, ["e1", "e2", "v3:city"], "update")).toEqual(
      new Set(["e2", "v3:city"]),
    );
  });
});

describe("robber tween", () => {
  it("arcs from start to end", () => {
    const from = [0, 0] as const;
    const to = [2, -1] as const;
    expect(robberPath(from, to, 0, ROBBER_MS)).toEqual([0, 0, 0]);
    const mid = robberPath(from, to, ROBBER_MS / 2, ROBBER_MS);
    expect(mid[0]).toBeCloseTo(1);
    expect(mid[1]).toBeGreaterThan(0.2);
    const end = robberPath(from, to, ROBBER_MS, ROBBER_MS);
    expect(end[0]).toBeCloseTo(2);
    expect(end[1]).toBeCloseTo(0);
    expect(end[2]).toBeCloseTo(-1);
  });

  it("tweens only on an update that moved it", () => {
    expect(shouldTweenRobber(null, 4, "update")).toBe(false);
    expect(shouldTweenRobber(9, 4, "snapshot")).toBe(false);
    expect(shouldTweenRobber(4, 4, "update")).toBe(false);
    expect(shouldTweenRobber(9, 4, "update")).toBe(true);
  });
});

describe("production glow", () => {
  const board = beginnerBoard();
  const roll = (total: number): GameEvent => ({
    type: "diceRolled",
    seat: 0,
    dice: [1, total - 1] as [number, number],
    total,
  });

  it("lights every hex with the rolled number except the robber's", () => {
    const eights = board.hexes.flatMap((h, i) => (h.token === 8 ? [i] : []));
    expect(eights.length).toBe(2);
    expect(producingHexes(board, 9, [roll(8)], "update")).toEqual(eights);
    expect(producingHexes(board, eights[0]!, [roll(8)], "update")).toEqual([eights[1]]);
  });

  it("is off for a 7, a snapshot, or a write without a roll", () => {
    expect(producingHexes(board, 9, [roll(7)], "update")).toEqual([]);
    expect(producingHexes(board, 9, [roll(8)], "snapshot")).toEqual([]);
    expect(producingHexes(board, 9, [{ type: "turnEnded", seat: 0 }], "update")).toEqual([]);
  });

  it("rises then fades out", () => {
    expect(glowStrength(0, GLOW_MS)).toBe(0);
    expect(glowStrength(GLOW_MS * 0.15, GLOW_MS)).toBeCloseTo(1);
    expect(glowStrength(GLOW_MS * 0.6, GLOW_MS)).toBeGreaterThan(0);
    expect(glowStrength(GLOW_MS, GLOW_MS)).toBe(0);
  });
});

describe("prefersReducedMotion", () => {
  it("reads the media query and is false without matchMedia", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});
