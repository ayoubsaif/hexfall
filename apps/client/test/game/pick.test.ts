import { describe, expect, it } from "vite-plus/test";
import { SEAT_COLORS, seatColor } from "../../src/game/colors.ts";
import { currentPick, isStaleBuild } from "../../src/game/pick.ts";
import { give, playState, put, seen, setupState, step } from "./fixtures.ts";

const sorted = (xs: Iterable<number>) => [...xs].sort((a, b) => a - b);

describe("currentPick", () => {
  it("setup: settlement intersections for the placing seat, then its road", () => {
    const s = setupState();
    const { view, legal } = seen(s, 0);
    const pick = currentPick({ view, legal, build: null });
    expect(pick?.kind).toBe("placeSettlement");
    expect(pick?.target).toBe("vertex");
    expect(sorted(pick!.targets)).toEqual(sorted(legal.placeSettlement));

    const v = legal.placeSettlement[0]!;
    const s2 = step(s, { type: "placeSettlement", seat: 0, vertex: v });
    const after = seen(s2, 0);
    const roadPick = currentPick({ view: after.view, legal: after.legal, build: null });
    expect(roadPick?.kind).toBe("placeRoad");
    expect(sorted(roadPick!.targets)).toEqual(sorted(after.legal.placeRoad));
  });

  it("no pick for a seat that is not placing", () => {
    const { view, legal } = seen(setupState(), 1);
    expect(currentPick({ view, legal, build: null })).toBeNull();
  });

  it("nothing while an action is in flight or after a win", () => {
    const { view, legal } = seen(setupState(), 0);
    expect(currentPick({ view, legal, build: null, inFlight: true })).toBeNull();
    expect(currentPick({ view: { ...view, winner: 2 }, legal, build: null })).toBeNull();
  });

  it("robber: every legal hex, none while a victim is being chosen", () => {
    const s = playState();
    s.phase = { kind: "moveRobber", source: "seven" };
    const { view, legal } = seen(s, 0);
    const pick = currentPick({ view, legal, build: null });
    expect(pick?.kind).toBe("moveRobber");
    expect(pick?.target).toBe("hex");
    expect(pick!.targets.size).toBe(18);
    expect(pick!.targets.has(s.robber)).toBe(false);
    expect(currentPick({ view, legal, build: null, victimHex: 3 })).toBeNull();
  });

  it("Road Building: the free road paths", () => {
    const s = playState();
    put(s, 10, 0);
    s.phase = { kind: "roadBuilding", remaining: 2 };
    const { view, legal } = seen(s, 0);
    const pick = currentPick({ view, legal, build: null });
    expect(pick?.kind).toBe("buildRoad");
    expect(pick!.targets.size).toBeGreaterThan(0);
    expect(sorted(pick!.targets)).toEqual(sorted(legal.buildRoad));
  });

  it("paid builds only while chosen", () => {
    const s = playState();
    put(s, 10, 0);
    give(s, 0, { brick: 2, lumber: 2, ore: 3, grain: 2 });
    const { view, legal } = seen(s, 0);
    expect(currentPick({ view, legal, build: null })).toBeNull();
    const r = currentPick({ view, legal, build: "road" });
    expect(r?.kind).toBe("buildRoad");
    expect(sorted(r!.targets)).toEqual(sorted(legal.buildRoad));
    const c = currentPick({ view, legal, build: "city" });
    expect(c?.kind).toBe("buildCity");
    expect([...c!.targets]).toEqual([10]);
  });

  it("a chosen build with no legal target gives no pick and is stale", () => {
    const s = playState();
    put(s, 10, 0);
    const { view, legal } = seen(s, 0); // empty hand
    expect(legal.buildSettlement).toEqual([]);
    expect(currentPick({ view, legal, build: "settlement" })).toBeNull();
    expect(isStaleBuild(legal, "settlement")).toBe(true);
    expect(isStaleBuild(legal, null)).toBe(false);
  });
});

describe("seat colors", () => {
  it("are four distinct colors with names", () => {
    expect(new Set(SEAT_COLORS.map((c) => c.hex)).size).toBe(4);
    expect(seatColor(1).name).toBe("Blue");
    expect(() => seatColor(4)).toThrow();
  });
});
