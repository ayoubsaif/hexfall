// Turn timer helpers (task 3.2): wait kinds, waited-on seats, restart rule, deadlines and
// the anchor replay used when a room is rebuilt.
import { applyAction, createGame, type Action, type GameState, type Phase } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { rebuildState } from "../src/rooms/room.ts";
import {
  deadlineOf,
  nextAnchor,
  restartsTimer,
  timerInfo,
  waitKind,
  waitingSeats,
} from "../src/rooms/timer.ts";
import type { LoadedRoom, RoomMeta } from "../src/store/types.ts";

const config = { seed: "timer", mode: "variable" as const, playerCount: 3 as const };

/** A fresh game moved to `phase`, active `seat`, rolled or not. */
function at(phase: Phase, seat = 0, rolled = false): GameState {
  const s = createGame(config);
  s.phase = phase;
  s.turn = { ...s.turn, seat, number: 3, rolled };
  return s;
}

const turn = (seat = 0, rolled = true) => at({ kind: "turn" }, seat, rolled);

describe("waitKind", () => {
  it("is roll for roll-for-order and a turn not yet rolled", () => {
    expect(waitKind(createGame(config))).toBe("roll");
    expect(waitKind(turn(1, false))).toBe("roll");
  });

  it("is action for every other running phase", () => {
    expect(waitKind(turn(1, true))).toBe("action");
    expect(
      waitKind(
        at({
          kind: "setup",
          order: [0, 1, 2, 2, 1, 0],
          index: 0,
          step: "settlement",
          lastSettlement: null,
        }),
      ),
    ).toBe("action");
    expect(waitKind(at({ kind: "discard", owed: [0, 4, 0] }, 0, true))).toBe("action");
    expect(waitKind(at({ kind: "moveRobber", source: "seven" }, 0, true))).toBe("action");
    expect(waitKind(at({ kind: "roadBuilding", remaining: 2 }, 0, true))).toBe("action");
  });

  it("is null once the game has ended", () => {
    expect(waitKind(at({ kind: "ended" }))).toBeNull();
  });
});

describe("waitingSeats", () => {
  it("lists the contenders still to roll for order", () => {
    const s = at({ kind: "rollForOrder", contenders: [0, 1, 2], rolls: [7, null, null] }, 1);
    expect(waitingSeats(s)).toEqual([1, 2]);
  });

  it("lists every seat that still owes a discard", () => {
    expect(waitingSeats(at({ kind: "discard", owed: [4, 0, 5] }, 1, true))).toEqual([0, 2]);
  });

  it("is the active seat otherwise, and nobody once ended", () => {
    expect(waitingSeats(turn(2))).toEqual([2]);
    expect(waitingSeats(at({ kind: "moveRobber", source: "knight" }, 1))).toEqual([1]);
    expect(waitingSeats(at({ kind: "ended" }))).toEqual([]);
  });
});

describe("restartsTimer", () => {
  it("restarts when the active player acts (Acting restarts the idle countdown)", () => {
    const build: Action = { type: "buildRoad", seat: 0, edge: 3 };
    expect(restartsTimer(turn(0), build, turn(0))).toBe(true);
  });

  it("does not restart for another seat's answer (Other players cannot extend the turn)", () => {
    const reject: Action = { type: "rejectTrade", seat: 1, offerId: 1 };
    expect(restartsTimer(turn(0), reject, turn(0))).toBe(false);
    const accept: Action = { type: "acceptTrade", seat: 2, offerId: 1 };
    expect(restartsTimer(turn(0), accept, turn(0))).toBe(false);
  });

  it("restarts for a discard by a seat that owes one, not by any other seat", () => {
    const before = at({ kind: "discard", owed: [0, 4, 5] }, 0, true);
    const after = at({ kind: "discard", owed: [0, 0, 5] }, 0, true);
    expect(restartsTimer(before, { type: "discard", seat: 1, cards: { ore: 4 } }, after)).toBe(
      true,
    );
    const free = at({ kind: "discard", owed: [0, 4, 0] }, 0, true);
    // Seat 2 owes nothing here (the engine would refuse it; the rule alone says no restart).
    expect(restartsTimer(free, { type: "discard", seat: 2, cards: {} }, free)).toBe(false);
  });

  it("restarts when the phase or the active player changes", () => {
    const owed = at({ kind: "discard", owed: [0, 4, 0] }, 0, true);
    // The last owing seat discards: phase changes to moveRobber.
    expect(
      restartsTimer(
        owed,
        { type: "discard", seat: 1, cards: { ore: 4 } },
        at({ kind: "moveRobber", source: "seven" }, 0, true),
      ),
    ).toBe(true);
    // Anything that hands the turn on (whoever the actor) restarts it.
    expect(restartsTimer(turn(0), { type: "acceptTrade", seat: 1, offerId: 1 }, turn(1))).toBe(
      true,
    );
  });

  it("always restarts after a timeout", () => {
    expect(restartsTimer(turn(0), { type: "timeout" }, turn(0))).toBe(true);
  });
});

describe("deadlines", () => {
  const anchor = 1_000_000;

  it("is anchor + the preset duration for the current wait", () => {
    expect(deadlineOf(createGame(config), anchor, "standard")).toBe(anchor + 30_000);
    expect(deadlineOf(turn(0, true), anchor, "standard")).toBe(anchor + 90_000);
    expect(deadlineOf(turn(0, false), anchor, "relaxed")).toBe(anchor + 60_000);
    expect(deadlineOf(turn(0, true), anchor, "relaxed")).toBe(anchor + 120_000);
  });

  it("is null with the timer off or the game ended", () => {
    expect(deadlineOf(turn(0, true), anchor, "off")).toBeNull();
    expect(deadlineOf(at({ kind: "ended" }), anchor, "standard")).toBeNull();
    expect(timerInfo(at({ kind: "ended" }), anchor, "standard", anchor)).toBeNull();
    expect(timerInfo(turn(0), anchor, "off", anchor)).toBeNull();
  });

  it("reports the remaining time at `now`, clamped to [0, duration]", () => {
    const s = turn(2, true);
    expect(timerInfo(s, anchor, "standard", anchor + 10_000)).toEqual({
      kind: "action",
      durationMs: 90_000,
      remainingMs: 80_000,
      seats: [2],
    });
    expect(timerInfo(s, anchor, "standard", anchor + 200_000)?.remainingMs).toBe(0);
    expect(timerInfo(s, anchor, "standard", anchor - 5_000)?.remainingMs).toBe(90_000);
  });

  it("nextAnchor moves to the record's time only on a restart, using the fallback without `at`", () => {
    const build: Action = { type: "buildRoad", seat: 0, edge: 3 };
    const reject: Action = { type: "rejectTrade", seat: 1, offerId: 1 };
    expect(nextAnchor(5, turn(0), { action: build, at: 80 }, turn(0), 99)).toBe(80);
    expect(nextAnchor(5, turn(0), { action: reject, at: 80 }, turn(0), 99)).toBe(5);
    expect(nextAnchor(5, turn(0), { action: build }, turn(0), 99)).toBe(99);
  });
});

describe("rebuildState replays the anchor", () => {
  const meta = (extra: Partial<RoomMeta> = {}): RoomMeta => ({
    code: "TMR",
    rev: 1,
    status: "playing",
    createdAt: 0,
    host: 0,
    seats: ["A", "B", "C"].map((name) => ({ name, tokenHash: "x" })),
    config,
    turnTimer: "standard",
    ...extra,
  });

  it("starts from startedAt and moves with each restarting action", () => {
    const s0 = createGame(config);
    const first = s0.turn.seat;
    const r = applyAction(s0, { type: "rollForOrder", seat: first });
    if (!r.ok) throw new Error(r.message);
    const loaded: LoadedRoom = {
      meta: meta({ startedAt: 1_000 }),
      snapshot: null,
      actions: [],
      version: 0,
    };
    expect(rebuildState(loaded, 9_999).anchor).toBe(1_000);
    const one: LoadedRoom = {
      ...loaded,
      actions: [{ action: { type: "rollForOrder", seat: first }, at: 4_000 }],
      version: 1,
    };
    const rebuilt = rebuildState(one, 9_999);
    expect(rebuilt.anchor).toBe(4_000);
    expect(rebuilt.state).toEqual(r.state);
  });

  it("uses the snapshot anchor, and the load time for data from before the timer", () => {
    const state = createGame(config);
    const snap: LoadedRoom = {
      meta: meta({ startedAt: 1_000 }),
      snapshot: { version: 3, state, anchor: 2_500 },
      actions: [],
      version: 3,
    };
    expect(rebuildState(snap, 9_999).anchor).toBe(2_500);
    const oldMeta = meta();
    delete oldMeta.turnTimer;
    const old: LoadedRoom = {
      meta: oldMeta,
      snapshot: { version: 3, state },
      actions: [],
      version: 3,
    };
    expect(rebuildState(old, 9_999).anchor).toBe(9_999);
    const noStart: LoadedRoom = { ...old, snapshot: null, version: 0 };
    expect(rebuildState(noStart, 7_777).anchor).toBe(7_777);
  });
});
