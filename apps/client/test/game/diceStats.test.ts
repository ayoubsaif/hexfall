import type { GameEvent } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { diceCounts } from "../../src/game/diceStats.ts";

const roll = (a: number, b: number): GameEvent => ({
  type: "diceRolled",
  seat: 0,
  dice: [a, b],
  total: a + b,
});

describe("diceCounts", () => {
  it("empty log: every total is 0", () => {
    const { counts, total } = diceCounts([]);
    expect(total).toBe(0);
    expect(Object.values(counts)).toEqual(Array(11).fill(0));
    expect(Object.keys(counts).map(Number)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("ignores rolls for turn order", () => {
    const log: GameEvent[] = [
      { type: "orderRolled", seat: 0, dice: [4, 5] },
      { type: "orderRolled", seat: 1, dice: [1, 3] },
    ];
    expect(diceCounts(log).total).toBe(0);
  });

  it("counts turn rolls by total", () => {
    const { counts, total } = diceCounts([
      roll(4, 4),
      roll(1, 5),
      roll(2, 6),
      roll(3, 4),
      roll(5, 6),
    ]);
    expect(total).toBe(5);
    expect(counts[8]).toBe(2);
    expect(counts[6]).toBe(1);
    expect(counts[7]).toBe(1);
    expect(counts[11]).toBe(1);
    expect(
      counts[2] + counts[3] + counts[4] + counts[5] + counts[9] + counts[10] + counts[12],
    ).toBe(0);
  });
});
