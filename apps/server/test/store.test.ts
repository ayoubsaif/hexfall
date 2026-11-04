import { describe, expect, it } from "vite-plus/test";
import { createMemoryStore } from "../src/store/memory.ts";
import { ROOM_TTL_MS, StoreUnavailableError } from "../src/store/types.ts";
import { makeMeta, makeSnapshot, roll, storeContract } from "./store.contract.ts";

storeContract("memory", async () => ({ store: createMemoryStore() }));

describe("memory store", () => {
  it("simulates an outage: writes are unavailable, loads throw", async () => {
    const store = createMemoryStore();
    expect(await store.createMeta(makeMeta("UP"))).toEqual({ ok: true });
    store.setAvailable(false);
    const down = { ok: false, reason: "unavailable" };
    expect(await store.createMeta(makeMeta("NEW"))).toEqual(down);
    expect(await store.saveMeta(makeMeta("UP", { rev: 1 }), 0)).toEqual(down);
    expect(await store.appendAction("UP", 0, roll())).toEqual(down);
    expect(await store.deleteRoom("UP")).toEqual(down);
    await expect(store.loadRoom("UP")).rejects.toBeInstanceOf(StoreUnavailableError);

    store.setAvailable(true);
    const loaded = await store.loadRoom("UP");
    expect(loaded?.meta).toEqual(makeMeta("UP"));
    expect(loaded?.version).toBe(0);
    expect(await store.loadRoom("NEW")).toBeNull();
  });

  it("refreshes the TTL on every write", async () => {
    let t = 1_000_000;
    const store = createMemoryStore({ now: () => t });
    await store.createMeta(makeMeta("TTL"));
    expect(store.ttl("TTL")).toBe(ROOM_TTL_MS);

    t += 1_000;
    expect(store.ttl("TTL")).toBe(ROOM_TTL_MS - 1_000);
    await store.saveMeta(makeMeta("TTL", { rev: 1 }), 0);
    expect(store.ttl("TTL")).toBe(ROOM_TTL_MS);

    t += 5_000;
    await store.appendAction("TTL", 0, roll(), makeSnapshot(1));
    expect(store.ttl("TTL")).toBe(ROOM_TTL_MS);

    // Failed writes and reads do not refresh it.
    t += 5_000;
    await store.appendAction("TTL", 0, roll());
    await store.loadRoom("TTL");
    expect(store.ttl("TTL")).toBe(ROOM_TTL_MS - 5_000);
  });

  it("expires a room ROOM_TTL_MS after its last write", async () => {
    let t = 0;
    const store = createMemoryStore({ now: () => t });
    await store.createMeta(makeMeta("EXP"));
    t = ROOM_TTL_MS - 1;
    expect(await store.loadRoom("EXP")).not.toBeNull();
    await store.appendAction("EXP", 0, roll());

    t += ROOM_TTL_MS - 1;
    expect((await store.loadRoom("EXP"))?.version).toBe(1);
    t += 1;
    expect(await store.loadRoom("EXP")).toBeNull();
    expect(store.ttl("EXP")).toBeNull();
    expect(await store.appendAction("EXP", 1, roll())).toEqual({ ok: false, reason: "not_found" });
    // The code can be reused with a clean history.
    expect(await store.createMeta(makeMeta("EXP"))).toEqual({ ok: true });
    expect((await store.loadRoom("EXP"))?.version).toBe(0);
  });
});
