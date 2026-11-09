// specs/tutorial-mode "Phase hint".
import { createGame } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { fixedT } from "../../src/i18n/index.ts";
import { hintOf } from "../../src/tutorial/hint.ts";
import { playState, seen, setupState } from "../game/fixtures.ts";

const view = (s: Parameters<typeof seen>[0], seat: number) => seen(s, seat).view;

describe("hintOf", () => {
  it("roll for order: yours, then waiting", () => {
    const s = createGame({ seed: 1, playerCount: 3, mode: "beginner" });
    expect(hintOf(view(s, 0))).toEqual({ key: "rollForOrder", rulesSection: "setup" });
    s.phase = { kind: "rollForOrder", contenders: [0, 1, 2], rolls: [7, null, null] };
    expect(hintOf(view(s, 0))?.key).toBe("rollForOrderWaiting");
  });

  it("setup: settlement and road, round 1 and 2, or waiting", () => {
    const s = setupState();
    expect(hintOf(view(s, 0))).toEqual({ key: "setupSettlement1", rulesSection: "setup" });
    expect(hintOf(view(s, 1))?.key).toBe("setupWaiting");
    if (s.phase.kind !== "setup") throw new Error("setup");
    s.phase.step = "road";
    expect(hintOf(view(s, 0))?.key).toBe("setupRoad1");
    s.phase.index = s.phase.order.length / 2; // first placement of round 2
    s.phase.step = "settlement";
    const seat = s.phase.order[s.phase.index]!;
    expect(hintOf(view(s, seat))?.key).toBe("setupSettlement2");
    s.phase.step = "road";
    expect(hintOf(view(s, seat))?.key).toBe("setupRoad2");
  });

  it("turn: roll first (Knight may come first), then trade/build, or waiting", () => {
    expect(hintOf(view(playState({ rolled: false }), 0))).toEqual({
      key: "rollFirst",
      rulesSection: "turn",
    });
    expect(hintOf(view(playState(), 0))?.key).toBe("main");
    expect(hintOf(view(playState({ seat: 2 }), 0))?.key).toBe("waiting");
    expect(fixedT("en")("tutorial.hint.rollFirst")).toMatch(/Knight/);
  });

  it("discard: yours with the count, or waiting", () => {
    const s = playState();
    s.phase = { kind: "discard", owed: [0, 4, 0, 0] };
    expect(hintOf(view(s, 1))).toEqual({ key: "discard", count: 4, rulesSection: "robber" });
    expect(hintOf(view(s, 0))?.key).toBe("discardWaiting");
  });

  it("robber: after a seven or a Knight, or waiting", () => {
    const s = playState();
    s.phase = { kind: "moveRobber", source: "seven" };
    expect(hintOf(view(s, 0))).toEqual({ key: "robberSeven", rulesSection: "robber" });
    expect(fixedT("en")("tutorial.hint.robberSeven")).toMatch(/different hex.*steal/);
    s.phase = { kind: "moveRobber", source: "knight" };
    expect(hintOf(view(s, 0))?.key).toBe("robberKnight");
    expect(hintOf(view(s, 1))?.key).toBe("robberWaiting");
  });

  it("road building and the end", () => {
    const s = playState();
    s.phase = { kind: "roadBuilding", remaining: 2 };
    expect(hintOf(view(s, 0))).toEqual({ key: "roadBuilding", count: 2, rulesSection: "devCards" });
    expect(hintOf(view(s, 3))?.key).toBe("roadBuildingWaiting");
    s.phase = { kind: "ended" };
    s.winner = 0;
    expect(hintOf(view(s, 0))).toBeNull();
  });
});
