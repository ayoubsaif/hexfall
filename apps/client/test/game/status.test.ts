import type { GameEvent } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import type { Names } from "../../src/game/describe.ts";
import { controlsOf, diceTotal, latestRoll, statusOf } from "../../src/game/status.ts";
import { give, playState, put, seen, setupState } from "./fixtures.ts";
import { createGame } from "@hexfall/engine";
import { fixedT } from "../../src/i18n/index.ts";

const tEn = fixedT("en");

const names: Names = (s) => ["Ana", "Ben", "Cy", "Dee"][s]!;

describe("statusOf", () => {
  it("roll for order: the viewer's prompt, or who is still rolling", () => {
    const s = createGame({ seed: 1, playerCount: 3, mode: "beginner" });
    expect(statusOf(seen(s, 0).view, names, tEn)).toEqual({
      text: "Roll for the starting player",
      yourMove: true,
    });
    const v = seen(s, 0).view;
    const rolled = {
      ...v,
      viewer: 0,
      phase: { kind: "rollForOrder" as const, contenders: [0, 1, 2], rolls: [7, null, null] },
    };
    expect(statusOf(rolled, names, tEn).text).toBe(
      "Rolling for the starting player: waiting for Ben, Cy",
    );
  });

  it("setup: placing seat and step", () => {
    const s = setupState();
    expect(statusOf(seen(s, 0).view, names, tEn)).toEqual({
      text: "Place your first settlement",
      yourMove: true,
    });
    expect(statusOf(seen(s, 2).view, names, tEn)).toEqual({
      text: "Ana is placing a settlement",
      yourMove: false,
    });
  });

  it("main turn before and after the roll", () => {
    expect(statusOf(seen(playState({ rolled: false }), 0).view, names, tEn).text).toBe(
      "Roll the dice",
    );
    expect(statusOf(seen(playState({ rolled: false }), 1).view, names, tEn).text).toBe(
      "Ana is about to roll",
    );
    expect(statusOf(seen(playState(), 0).view, names, tEn).yourMove).toBe(true);
    expect(statusOf(seen(playState({ seat: 2 }), 0).view, names, tEn)).toEqual({
      text: "Cy's turn",
      yourMove: false,
    });
  });

  it("discard lists who still owes cards", () => {
    const s = playState();
    s.phase = { kind: "discard", owed: [0, 4, 0, 5] };
    expect(statusOf(seen(s, 1).view, names, tEn)).toEqual({
      text: "A 7! Discard 4 cards",
      yourMove: true,
    });
    expect(statusOf(seen(s, 0).view, names, tEn).text).toBe("A 7! Waiting for Ben, Dee to discard");
  });

  it("robber, road building and game over", () => {
    const s = playState();
    s.phase = { kind: "moveRobber", source: "knight" };
    expect(statusOf(seen(s, 0).view, names, tEn).text).toBe("Move the robber: pick a hex");
    expect(statusOf(seen(s, 1).view, names, tEn).text).toBe("Ana is moving the robber");
    s.phase = { kind: "roadBuilding", remaining: 1 };
    expect(statusOf(seen(s, 0).view, names, tEn).text).toBe("Place a free road (1 left)");
    s.phase = { kind: "ended" };
    s.winner = 3;
    expect(statusOf(seen(s, 0).view, names, tEn).text).toBe("Dee won the game");
  });
});

describe("controlsOf", () => {
  it("before the roll only Roll is on", () => {
    const { view, legal } = seen(playState({ rolled: false }), 0);
    const c = controlsOf(view, legal);
    expect(c.rollDice).toBe(true);
    expect(c.endTurn).toBe(false);
    expect(c.buildRoad || c.buildSettlement || c.buildCity || c.buyDevCard).toBe(false);
  });

  it("follows legal after the roll, and all off while in flight or for other seats", () => {
    const s = playState();
    put(s, 10, 0);
    give(s, 0, { ore: 4, grain: 3, wool: 1, brick: 1, lumber: 1 });
    const { view, legal } = seen(s, 0);
    const c = controlsOf(view, legal);
    expect(c).toMatchObject({
      rollDice: false,
      endTurn: true,
      buyDevCard: true,
      buildRoad: true,
      buildCity: true,
      maritime: true,
    });
    expect(controlsOf(view, legal, true).endTurn).toBe(false);
    const other = seen(s, 1);
    expect(controlsOf(other.view, other.legal).endTurn).toBe(false);
  });
});

describe("latestRoll", () => {
  it("is the last roll of the current turn", () => {
    expect(latestRoll([])).toBeNull();
    const log = [
      { type: "diceRolled", seat: 0, dice: [1, 2], total: 3 },
      { type: "turnEnded", seat: 0 },
      { type: "turnStarted", seat: 1, number: 2 },
    ] satisfies GameEvent[];
    expect(latestRoll([...log])).toBeNull();
    const roll = latestRoll([...log, { type: "diceRolled", seat: 1, dice: [6, 5], total: 11 }]);
    expect(roll).toEqual({ dice: [6, 5], seat: 1, index: 3 });
    expect(diceTotal(roll)).toBe(11);
    expect(latestRoll([{ type: "orderRolled", seat: 2, dice: [3, 3] }])?.seat).toBe(2);
  });
});
