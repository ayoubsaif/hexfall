// "Time ran out" lines and toasts for the timedOut event (task 4.2).
import type { GameEvent, PhaseKind } from "@hexfall/engine";
import { describe as suite, expect, it } from "vite-plus/test";
import { describe, toastFor, type Names } from "../../src/game/describe.ts";
import { fixedT } from "../../src/i18n/index.ts";

const tEn = fixedT("en");

const names: Names = (s) => ["Ana", "Ben", "Cy", "Dee"][s] ?? `Seat ${s + 1}`;
const timedOut = (phase: PhaseKind, seats = [0]): GameEvent => ({ type: "timedOut", phase, seats });
const rolled: GameEvent = { type: "diceRolled", seat: 0, dice: [2, 3], total: 5 };
const ended: GameEvent = { type: "turnEnded", seat: 0 };

suite("timedOut log line", () => {
  it("names the automatic roll before the roll", () => {
    expect(describe(timedOut("turn"), names, tEn, rolled).text).toBe(
      "Time ran out for Ana: dice rolled automatically.",
    );
  });

  it("names the end of the turn after the roll", () => {
    expect(describe(timedOut("turn"), names, tEn, ended).text).toBe(
      "Time ran out for Ana: turn ended.",
    );
  });

  it.each([
    ["rollForOrder", "rolled for order"],
    ["setup", "setup piece placed"],
    ["moveRobber", "robber moved"],
    ["roadBuilding", "free roads placed"],
  ] as const)("phase %s", (phase, outcome) => {
    expect(describe(timedOut(phase), names, tEn).text).toBe(`Time ran out for Ana: ${outcome}.`);
  });

  it("lists every seat that had to discard", () => {
    const line = describe(timedOut("discard", [1, 2, 3]), names, tEn);
    expect(line.text).toBe("Time ran out for Ben, Cy and Dee: cards discarded.");
    expect(line.seats).toEqual([1, 2, 3]);
  });
});

suite("timedOut toast", () => {
  it("speaks to the viewer whose time ran out", () => {
    expect(toastFor(timedOut("turn"), 0, names, tEn, rolled)).toEqual({
      text: "Time ran out: dice rolled automatically",
      tone: "bad",
      seat: 0,
    });
    expect(toastFor(timedOut("discard", [0, 2]), 2, names, tEn)).toEqual({
      text: "Time ran out for you and Ana: cards discarded",
      tone: "bad",
      seat: 0,
    });
  });

  it("tells the others who timed out", () => {
    expect(toastFor(timedOut("turn"), 1, names, tEn, ended)).toEqual({
      text: "Time ran out for Ana: turn ended",
      tone: "info",
      seat: 0,
    });
    expect(toastFor(timedOut("moveRobber"), null, names, tEn)?.tone).toBe("info");
  });
});
