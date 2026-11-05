// Shared RoomStore contract: every implementation (memory, Redis) must pass it.
import { createGame, type Action, type Seat } from "@hexfall/engine";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { ActionRecord, RoomMeta, RoomStore, Snapshot } from "../src/store/types.ts";

export interface StoreFixture {
  store: RoomStore;
  cleanup?: () => Promise<void>;
  /** Appends raw stored JSON for `code` (to test records written in an older format). */
  pushRaw?: (code: string, json: string) => Promise<void>;
}

let codeCounter = 0;
/** A fresh code per test so implementations sharing a backend never collide. */
export function freshCode(): string {
  codeCounter++;
  return `T${Date.now().toString(36).toUpperCase()}${codeCounter}`;
}

export function makeMeta(code: string, overrides: Partial<RoomMeta> = {}): RoomMeta {
  return {
    code,
    rev: 0,
    status: "lobby",
    createdAt: 1_700_000_000_000,
    host: 0,
    seats: [{ name: "Alice", tokenHash: "a".repeat(64) }],
    config: null,
    ...overrides,
  };
}

/** A stored rollDice record for `seat`, accepted at a seat-dependent server time. */
export const roll = (seat: Seat = 0): ActionRecord => ({
  action: { type: "rollDice", seat },
  at: 1_700_000_100_000 + seat,
});

export function makeSnapshot(version: number): Snapshot {
  return { version, state: createGame({ seed: "contract", playerCount: 3, mode: "variable" }) };
}

export function storeContract(name: string, make: () => Promise<StoreFixture>): void {
  describe(`RoomStore contract: ${name}`, () => {
    let fx: StoreFixture;
    let store: RoomStore;
    beforeEach(async () => {
      fx = await make();
      store = fx.store;
    });
    afterEach(async () => {
      await fx.cleanup?.();
    });

    /** Creates a room and appends `n` roll actions. */
    async function seed(code: string, n = 0): Promise<void> {
      expect(await store.createMeta(makeMeta(code))).toEqual({ ok: true });
      for (let i = 0; i < n; i++) {
        expect(await store.appendAction(code, i, roll(i % 3 === 0 ? 0 : 1))).toEqual({ ok: true });
      }
    }

    it("createMeta stores a room, then reports exists for the same code", async () => {
      const code = freshCode();
      expect(await store.createMeta(makeMeta(code))).toEqual({ ok: true });
      expect(await store.createMeta(makeMeta(code, { host: 1 }))).toEqual({
        ok: false,
        reason: "exists",
      });
      const loaded = await store.loadRoom(code);
      expect(loaded).toEqual({ meta: makeMeta(code), snapshot: null, actions: [], version: 0 });
    });

    it("createMeta requires rev 0", async () => {
      await expect(store.createMeta(makeMeta(freshCode(), { rev: 1 }))).rejects.toThrow();
    });

    it("saveMeta replaces meta when the rev matches", async () => {
      const code = freshCode();
      await seed(code);
      const next = makeMeta(code, {
        rev: 1,
        seats: [
          { name: "Alice", tokenHash: "a".repeat(64) },
          { name: "Bob", tokenHash: "b".repeat(64) },
        ],
      });
      expect(await store.saveMeta(next, 0)).toEqual({ ok: true });
      expect((await store.loadRoom(code))?.meta).toEqual(next);
      const third = makeMeta(code, {
        rev: 2,
        status: "playing",
        config: { seed: "abc", mode: "variable", playerCount: 3, startingPlayer: 1 },
      });
      expect(await store.saveMeta(third, 1)).toEqual({ ok: true });
      expect((await store.loadRoom(code))?.meta).toEqual(third);
    });

    it("saveMeta reports conflict on a stale rev and keeps the stored meta", async () => {
      const code = freshCode();
      await seed(code);
      expect(await store.saveMeta(makeMeta(code, { rev: 1 }), 0)).toEqual({ ok: true });
      expect(await store.saveMeta(makeMeta(code, { rev: 1, host: 2 }), 0)).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect((await store.loadRoom(code))?.meta).toEqual(makeMeta(code, { rev: 1 }));
    });

    it("saveMeta reports not_found for an unknown room", async () => {
      expect(await store.saveMeta(makeMeta(freshCode(), { rev: 1 }), 0)).toEqual({
        ok: false,
        reason: "not_found",
      });
    });

    it("saveMeta requires rev = expectedRev + 1", async () => {
      const code = freshCode();
      await seed(code);
      await expect(store.saveMeta(makeMeta(code, { rev: 0 }), 0)).rejects.toThrow();
      await expect(store.saveMeta(makeMeta(code, { rev: 3 }), 0)).rejects.toThrow();
    });

    it("appendAction appends only when expectedVersion equals the stored count", async () => {
      const code = freshCode();
      await seed(code);
      expect(await store.appendAction(code, 1, roll())).toEqual({ ok: false, reason: "conflict" });
      expect(await store.appendAction(code, 0, roll(0))).toEqual({ ok: true });
      expect(await store.appendAction(code, 0, roll(1))).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect(await store.appendAction(code, 1, roll(1))).toEqual({ ok: true });
      const loaded = await store.loadRoom(code);
      expect(loaded?.actions).toEqual([roll(0), roll(1)]);
      expect(loaded?.version).toBe(2);
      expect(loaded?.snapshot).toBeNull();
    });

    it("appendAction reports not_found for an unknown room", async () => {
      expect(await store.appendAction(freshCode(), 0, roll())).toEqual({
        ok: false,
        reason: "not_found",
      });
    });

    it("appendAction stores a snapshot, and loadRoom returns only later actions", async () => {
      const code = freshCode();
      await seed(code, 2);
      const snap = makeSnapshot(3);
      expect(await store.appendAction(code, 2, roll(2), snap)).toEqual({ ok: true });
      expect(await store.appendAction(code, 3, roll(0))).toEqual({ ok: true });
      expect(await store.appendAction(code, 4, roll(1))).toEqual({ ok: true });
      const loaded = await store.loadRoom(code);
      expect(loaded?.snapshot).toEqual(snap);
      expect(loaded?.actions).toEqual([roll(0), roll(1)]);
      expect(loaded?.version).toBe(5);

      // A newer snapshot replaces the old one.
      const snap2 = makeSnapshot(6);
      expect(await store.appendAction(code, 5, roll(2), snap2)).toEqual({ ok: true });
      const again = await store.loadRoom(code);
      expect(again?.snapshot).toEqual(snap2);
      expect(again?.actions).toEqual([]);
      expect(again?.version).toBe(6);
    });

    it("appendAction rejects a snapshot whose version is not expectedVersion + 1", async () => {
      const code = freshCode();
      await seed(code);
      await expect(store.appendAction(code, 0, roll(), makeSnapshot(2))).rejects.toThrow();
      expect((await store.loadRoom(code))?.version).toBe(0);
    });

    it("loadRoom returns null for an unknown room", async () => {
      expect(await store.loadRoom(freshCode())).toBeNull();
    });

    it("deleteRoom removes meta, actions and snapshot", async () => {
      const code = freshCode();
      await seed(code);
      expect(await store.appendAction(code, 0, roll(), makeSnapshot(1))).toEqual({ ok: true });
      expect(await store.deleteRoom(code)).toEqual({ ok: true });
      expect(await store.loadRoom(code)).toBeNull();
      expect(await store.appendAction(code, 1, roll())).toEqual({
        ok: false,
        reason: "not_found",
      });
      // The code is free again, with no leftover history.
      expect(await store.createMeta(makeMeta(code))).toEqual({ ok: true });
      expect(await store.loadRoom(code)).toEqual({
        meta: makeMeta(code),
        snapshot: null,
        actions: [],
        version: 0,
      });
    });

    it("deleteRoom on an unknown room is ok", async () => {
      expect(await store.deleteRoom(freshCode())).toEqual({ ok: true });
    });

    it("round-trips the timer fields: meta turnTimer/startedAt, record at, snapshot anchor", async () => {
      const code = freshCode();
      const meta = makeMeta(code, { turnTimer: "standard", startedAt: 1_700_000_000_500 });
      expect(await store.createMeta(meta)).toEqual({ ok: true });
      expect((await store.loadRoom(code))?.meta).toEqual(meta);
      const relaxed = { ...meta, rev: 1, turnTimer: "relaxed" as const };
      expect(await store.saveMeta(relaxed, 0)).toEqual({ ok: true });
      expect((await store.loadRoom(code))?.meta).toEqual(relaxed);

      const timeout: ActionRecord = { action: { type: "timeout" }, at: 1_700_000_090_500 };
      const noAt: ActionRecord = { action: { type: "endTurn", seat: 1 } };
      expect(await store.appendAction(code, 0, roll(2))).toEqual({ ok: true });
      expect(await store.appendAction(code, 1, timeout)).toEqual({ ok: true });
      expect(await store.appendAction(code, 2, noAt)).toEqual({ ok: true });
      expect((await store.loadRoom(code))?.actions).toEqual([roll(2), timeout, noAt]);

      const snap = { ...makeSnapshot(4), anchor: 1_700_000_090_500 };
      expect(await store.appendAction(code, 3, roll(0), snap)).toEqual({ ok: true });
      const loaded = await store.loadRoom(code);
      expect(loaded?.snapshot).toEqual(snap);
      expect(loaded?.snapshot?.anchor).toBe(1_700_000_090_500);
      expect(loaded?.actions).toEqual([]);
    });

    it("loads data written before the timer: no turnTimer, startedAt, at or anchor", async () => {
      if (!fx.pushRaw) return;
      const code = freshCode();
      const meta = makeMeta(code, {
        status: "playing",
        config: { seed: "old", mode: "variable", playerCount: 3 },
      });
      expect(await store.createMeta(meta)).toEqual({ ok: true });
      // The pre-timer format: bare action JSON, a snapshot without anchor.
      await fx.pushRaw(code, JSON.stringify({ type: "rollForOrder", seat: 0 }));
      await fx.pushRaw(code, JSON.stringify({ type: "rollForOrder", seat: 1 }));
      expect(await store.appendAction(code, 2, roll(2))).toEqual({ ok: true });
      const loaded = await store.loadRoom(code);
      expect(loaded?.meta.turnTimer).toBeUndefined();
      expect(loaded?.meta.startedAt).toBeUndefined();
      expect(loaded?.actions).toEqual([
        { action: { type: "rollForOrder", seat: 0 } },
        { action: { type: "rollForOrder", seat: 1 } },
        roll(2),
      ]);
      expect(loaded?.version).toBe(3);
    });

    it("never aliases caller or returned objects", async () => {
      const code = freshCode();
      const meta = makeMeta(code);
      await store.createMeta(meta);
      meta.seats[0]!.name = "Mallory";
      meta.host = 3;
      const action = { type: "rollDice", seat: 0 } satisfies Action;
      const record = { action, at: 1_700_000_100_000 };
      await store.appendAction(code, 0, record);
      action.seat = 2;
      record.at = 5;

      const first = await store.loadRoom(code);
      expect(first?.meta).toEqual(makeMeta(code));
      expect(first?.actions).toEqual([roll(0)]);
      first!.meta.seats.push({ name: "Eve", tokenHash: "e" });
      first!.meta.status = "ended";
      (first!.actions[0]!.action as { seat: Seat }).seat = 3;

      const second = await store.loadRoom(code);
      expect(second?.meta).toEqual(makeMeta(code));
      expect(second?.actions).toEqual([roll(0)]);

      const snap = makeSnapshot(2);
      const expected = makeSnapshot(2);
      await store.appendAction(code, 1, roll(1), snap);
      (snap as { version: number }).version = 99;
      const third = await store.loadRoom(code);
      expect(third?.snapshot).toEqual(expected);
      (third!.snapshot as { version: number }).version = 42;
      expect((await store.loadRoom(code))?.snapshot).toEqual(expected);
    });

    it("round-trips unicode names", async () => {
      const code = freshCode();
      const names = ["Zoë", "Łukasz", "東京の王", "😀 Ünïcødé", "Ἀθηνᾶ"];
      const meta = makeMeta(code, {
        seats: names.map((name, i) => ({ name, tokenHash: String(i).repeat(64) })),
      });
      expect(await store.createMeta(meta)).toEqual({ ok: true });
      expect((await store.loadRoom(code))?.meta).toEqual(meta);
      const renamed = { ...meta, rev: 1, seats: [{ name: "ñandú \u{1F3B2}", tokenHash: "x" }] };
      expect(await store.saveMeta(renamed, 0)).toEqual({ ok: true });
      expect((await store.loadRoom(code))?.meta).toEqual(renamed);
    });

    it("loadMeta returns meta and a positive TTL, or null", async () => {
      const code = freshCode();
      expect(await store.loadMeta(code)).toBeNull();
      const meta = makeMeta(code, { status: "paused", pausedAt: 5, pauses: [{ at: 1, ms: 2 }] });
      expect(await store.createMeta(meta)).toEqual({ ok: true });
      const got = await store.loadMeta(code);
      expect(got?.meta).toEqual(meta);
      expect(got?.ttlMs).toBeGreaterThan(0);
      expect(got?.lastActionAt).toBeNull();
      expect(await store.appendAction(code, 0, roll(1))).toEqual({ ok: true });
      expect((await store.loadMeta(code))?.lastActionAt).toBe(roll(1).at);
    });

    it("saveMeta with a ttl sets the expiry; loadMeta never refreshes it", async () => {
      const code = freshCode();
      await seed(code, 1);
      expect(await store.saveMeta(makeMeta(code, { rev: 1 }), 0, 60_000)).toEqual({ ok: true });
      const first = await store.loadMeta(code);
      expect(first?.ttlMs).toBeGreaterThan(0);
      expect(first?.ttlMs).toBeLessThanOrEqual(60_000);
      await store.loadMeta(code);
      await store.loadRoom(code);
      expect((await store.loadMeta(code))?.ttlMs).toBeLessThanOrEqual(first?.ttlMs ?? 0);
      // A later write without a ttl restores the normal expiry.
      expect(await store.saveMeta(makeMeta(code, { rev: 2 }), 1)).toEqual({ ok: true });
      expect((await store.loadMeta(code))?.ttlMs).toBeGreaterThan(60_000);
    });
  });
}
