// specs/tutorial-mode "Rule helpers on game controls": why a control is unavailable.
import { describe, expect, it } from "vite-plus/test";
import { fixedT } from "../../src/i18n/index.ts";
import { blockerFor, blockerText, missingCards } from "../../src/tutorial/blockers.ts";
import { give, playState, put, seen } from "../game/fixtures.ts";

const tEn = fixedT("en");
const of = (s: Parameters<typeof seen>[0], seat = 0) => {
  const { view, legal } = seen(s, seat);
  return [view, legal] as const;
};

describe("blockerFor", () => {
  it("not your turn", () => {
    expect(blockerFor("road", ...of(playState({ seat: 1 }), 0))).toEqual({ key: "notYourTurn" });
    expect(blockerFor("knight", ...of(playState({ seat: 1 }), 0))).toEqual({
      key: "notYourTurn",
    });
  });

  it("roll first", () => {
    const s = playState({ rolled: false });
    give(s, 0, { brick: 1, lumber: 1 });
    expect(blockerFor("road", ...of(s))).toEqual({ key: "rollFirst" });
    expect(blockerFor("endTurn", ...of(s))).toEqual({ key: "rollFirst" });
  });

  it("missing cards, listed", () => {
    const s = playState();
    give(s, 0, { grain: 1, ore: 1 });
    const b = blockerFor("city", ...of(s));
    expect(b).toEqual({ key: "cards", missing: { grain: 1, ore: 2 } });
    expect(blockerText(b!, tEn)).toMatch(/^You need 1 grain, 2 ore\.$/i);
  });

  it("no pieces left", () => {
    const s = playState();
    give(s, 0, { brick: 1, lumber: 1 });
    s.players[0]!.pieces.roads = 0;
    expect(blockerFor("road", ...of(s))).toEqual({ key: "pieces" });
  });

  it("no legal spot", () => {
    const s = playState();
    give(s, 0, { ore: 3, grain: 2 });
    expect(blockerFor("city", ...of(s))).toEqual({ key: "noSpot", build: "city" });
    expect(blockerText({ key: "noSpot", build: "city" }, tEn)).toMatch(/no settlement/);
  });

  it("available: no blocker", () => {
    const s = playState();
    put(s, 0, 0);
    give(s, 0, { ore: 3, grain: 2 });
    expect(blockerFor("city", ...of(s))).toBeNull();
  });

  it("development deck empty", () => {
    const s = playState();
    give(s, 0, { ore: 1, wool: 1, grain: 1 });
    s.devDeck = [];
    expect(blockerFor("devBuy", ...of(s))).toEqual({ key: "deckEmpty" });
  });

  it("card bought this turn", () => {
    const s = playState();
    s.players[0]!.devCards = ["knight"];
    s.players[0]!.boughtThisTurn = ["knight"];
    expect(blockerFor("knight", ...of(s))).toEqual({ key: "boughtThisTurn" });
  });

  it("already played a card this turn", () => {
    const s = playState();
    s.players[0]!.devCards = ["monopoly"];
    s.turn.devPlayed = true;
    expect(blockerFor("monopoly", ...of(s))).toEqual({ key: "alreadyPlayed" });
  });

  it("a Knight is playable before the roll", () => {
    const s = playState({ rolled: false });
    s.players[0]!.devCards = ["knight"];
    expect(blockerFor("knight", ...of(s))).toBeNull();
  });

  it("finish the current step first", () => {
    const s = playState();
    s.phase = { kind: "moveRobber", source: "seven" };
    expect(blockerFor("endTurn", ...of(s))).toEqual({ key: "finishStep" });
  });

  it("trades wait for the roll", () => {
    expect(blockerFor("maritime", ...of(playState({ rolled: false })))).toEqual({
      key: "rollFirst",
    });
    expect(blockerFor("trade", ...of(playState({ rolled: false })))).toEqual({
      key: "rollFirst",
    });
  });

  it("topics without a control never block", () => {
    expect(blockerFor("roll", ...of(playState()))).toBeNull();
    expect(blockerFor("victoryPoint", ...of(playState()))).toBeNull();
  });
});

describe("missingCards", () => {
  it("only the shortfall", () => {
    expect(
      missingCards({ brick: 1, lumber: 1 }, { brick: 1, lumber: 0, wool: 0, grain: 0, ore: 0 }),
    ).toEqual({
      lumber: 1,
    });
  });
});
