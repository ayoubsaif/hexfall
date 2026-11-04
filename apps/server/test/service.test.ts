import { afterEach, describe, expect, it } from "vite-plus/test";
import type { Action } from "@hexfall/engine";
import { CloseCode } from "@hexfall/protocol";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import { drive, fakeConn, makeLobby, nextMove, req, type FakeConn } from "../src/rooms/testing.ts";
import { createMemoryStore } from "../src/store/memory.ts";
import type { RoomStore } from "../src/store/types.ts";

const services: RoomService[] = [];
const logs: string[] = [];

function service(store: RoomStore, idleEvictMs?: number): RoomService {
  const svc = createRoomService({
    store,
    log: (m) => logs.push(m),
    ...(idleEvictMs !== undefined ? { idleEvictMs } : {}),
  });
  services.push(svc);
  return svc;
}

afterEach(() => {
  for (const s of services.splice(0)) s.close();
  logs.length = 0;
});

const err = (code: string) => ({ ok: false, error: { code, message: expect.any(String) } });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startedGame(svc: RoomService, n = 3) {
  const lobby = await makeLobby(svc, ["Ana", "Ben", "Cy", "Dee"].slice(0, n));
  expect(await svc.startGame(req(lobby.conns[0] as FakeConn), { mode: "variable" })).toEqual({
    ok: true,
  });
  return lobby;
}

describe("connection binding", () => {
  it("a bound connection cannot create, join or resume again", async () => {
    const store = createMemoryStore();
    const svc = service(store);
    const { conns, code, tokens } = await makeLobby(svc, ["Ana", "Ben"]);
    const ana = conns[0] as FakeConn;
    ana.clear();
    expect(await svc.createRoom(req(ana), "Ana2")).toEqual(err("already_in_room"));
    expect(await svc.joinRoom(req(ana), code, "Ana2")).toEqual(err("already_in_room"));
    expect(await svc.resumeRoom(req(ana), code, tokens[1] ?? "")).toEqual(err("already_in_room"));
    expect(ana.sent).toEqual([]);
    expect(svc.loadedRooms()).toBe(1);
  });

  it("a concurrent second claim on the same connection is refused", async () => {
    const svc = service(createMemoryStore());
    const c = fakeConn();
    const [a, b] = await Promise.all([svc.createRoom(req(c), "Ana"), svc.createRoom(req(c), "Bo")]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual(err("already_in_room"));
    expect(svc.loadedRooms()).toBe(1);
  });

  it("an unbound connection cannot leave, start or act", async () => {
    const svc = service(createMemoryStore());
    const c = fakeConn();
    expect(await svc.leaveRoom(req(c))).toEqual(err("no_seat"));
    expect(await svc.startGame(req(c), { mode: "beginner" })).toEqual(err("no_seat"));
    expect(await svc.gameAction(req(c), { type: "rollDice" })).toEqual(err("no_seat"));
  });

  it("a connection that left can create a new room", async () => {
    const svc = service(createMemoryStore());
    const { conns } = await makeLobby(svc, ["Ana", "Ben"]);
    const ben = conns[1] as FakeConn;
    expect(await svc.leaveRoom(req(ben))).toEqual({ ok: true });
    expect(await svc.createRoom(req(ben), "Ben")).toEqual({ ok: true });
    expect(svc.loadedRooms()).toBe(2);
  });

  it("store outages give unavailable on create, join and resume", async () => {
    const store = createMemoryStore();
    const svc = service(store);
    const { code, tokens } = await makeLobby(svc, ["Ana"]);
    store.setAvailable(false);
    expect(await svc.createRoom(req(fakeConn()), "Bo")).toEqual(err("unavailable"));
    expect(await svc.joinRoom(req(fakeConn()), code, "Bo")).toEqual(err("unavailable"));
    // a fresh service has to load the room, which throws during the outage
    const other = service(store);
    expect(await other.resumeRoom(req(fakeConn()), code, tokens[0] ?? "")).toEqual(
      err("unavailable"),
    );
    store.setAvailable(true);
    const c = fakeConn();
    expect(await svc.joinRoom(req(c), code, "Bo")).toEqual({ ok: true });
  });
});

describe("resume", () => {
  it("wrong token and unknown room fail identically", async () => {
    const svc = service(createMemoryStore());
    const { code } = await makeLobby(svc, ["Ana"]);
    const a = fakeConn();
    const b = fakeConn();
    const c = fakeConn();
    const wrong = await svc.resumeRoom(req(a), code, "not-a-token");
    const unknown = await svc.resumeRoom(req(b), "ZZZZZZ", "not-a-token");
    const malformed = await svc.resumeRoom(req(c), "??", "not-a-token");
    expect(wrong).toEqual(err("bad_token"));
    expect(unknown).toEqual(wrong);
    expect(malformed).toEqual(wrong);
    expect([...a.sent, ...b.sent, ...c.sent]).toEqual([]);
  });

  it("resuming in the lobby rebinds the seat without a token or snapshot", async () => {
    const svc = service(createMemoryStore());
    const { conns, code, tokens } = await makeLobby(svc, ["Ana", "Ben"]);
    const ben = conns[1] as FakeConn;
    svc.disconnect(ben);
    expect(conns[0]?.of("roomState").at(-1)?.payload.seats[1]?.connected).toBe(false);
    const again = fakeConn();
    const r = req(again);
    expect(await svc.resumeRoom(r, code.toLowerCase(), tokens[1] ?? "")).toEqual({ ok: true });
    expect(again.sent.map((m) => m.type)).toEqual(["roomJoined", "roomState"]);
    expect(again.sent[0]).toEqual({
      type: "roomJoined",
      payload: { room: code, seat: 1 },
      re: r.seq,
    });
    expect(again.sent[1]?.re).toBe(r.seq);
    expect(conns[0]?.of("roomState").at(-1)?.payload.seats[1]?.connected).toBe(true);
  });

  it("a second connection replaces the first with close code 4001", async () => {
    const svc = service(createMemoryStore());
    const { conns, code, tokens } = await startedGame(svc);
    const ben = conns[1] as FakeConn;
    const tab2 = fakeConn();
    expect(await svc.resumeRoom(req(tab2), code, tokens[1] ?? "")).toEqual({ ok: true });
    expect(ben.closed?.code).toBe(CloseCode.Replaced);
    expect(tab2.sent.map((m) => m.type)).toEqual(["roomJoined", "roomState", "gameSnapshot"]);
    expect(tab2.game()?.view.viewer).toBe(1);
    // the old connection is unbound; the new one acts as seat 1
    expect(await svc.gameAction(req(ben), { type: "rollForOrder" })).toEqual(err("no_seat"));
    expect(await svc.gameAction(req(conns[0] as FakeConn), { type: "rollForOrder" })).toEqual({
      ok: true,
    });
    ben.clear();
    expect(await svc.gameAction(req(tab2), { type: "rollForOrder" })).toEqual({ ok: true });
    expect(ben.sent).toEqual([]);
    expect(tab2.of("gameUpdate")).toHaveLength(2);
    // the late close of the replaced socket does not mark seat 1 disconnected
    svc.disconnect(ben);
    expect(tab2.of("roomState").at(-1)?.payload.seats[1]?.connected).toBe(true);
  });
});

describe("rebuild from the store", () => {
  it("after 40+ actions (snapshot at 25) a new service rebuilds the same views", async () => {
    const store = createMemoryStore();
    const svc = service(store);
    const { conns, code, tokens } = await startedGame(svc, 4);
    await drive(svc, conns, () => false, 42);
    const stored = await store.loadRoom(code);
    expect(stored?.version).toBe(42);
    expect(stored?.snapshot?.version).toBe(25);
    expect(stored?.actions).toHaveLength(17);
    const before = conns.map((c) => c.game());

    const restarted = service(store);
    expect(restarted.loadedRooms()).toBe(0);
    const fresh = conns.map(() => fakeConn());
    for (const [seat, c] of fresh.entries()) {
      expect(await restarted.resumeRoom(req(c), code, tokens[seat] ?? "")).toEqual({ ok: true });
    }
    expect(restarted.loadedRooms()).toBe(1);
    for (const [seat, c] of fresh.entries()) {
      const snap = c.of("gameSnapshot")[0]?.payload;
      expect(snap?.version).toBe(42);
      expect(snap?.view).toEqual(before[seat]?.view);
      expect(snap?.legal).toEqual(before[seat]?.legal);
    }
    // the next action applies normally
    await drive(restarted, fresh, () => false, 1);
    expect(fresh[0]?.of("gameUpdate")[0]?.payload.version).toBe(43);
    expect((await store.loadRoom(code))?.version).toBe(43);
  });

  it("concurrent loads of one room share a single rebuild", async () => {
    const store = createMemoryStore();
    const svc = service(store);
    const { code, tokens } = await startedGame(svc);
    let loads = 0;
    const counting: RoomStore = {
      ...store,
      loadRoom: (c) => {
        loads++;
        return store.loadRoom(c);
      },
    };
    const restarted = service(counting);
    const results = await Promise.all(
      tokens.map((t) => restarted.resumeRoom(req(fakeConn()), code, t)),
    );
    expect(results).toEqual(tokens.map(() => ({ ok: true })));
    expect(loads).toBe(1);
  });

  it("a stored game that cannot be replayed fails with internal", async () => {
    const store = createMemoryStore();
    const svc = service(store);
    const { code, tokens } = await startedGame(svc);
    // seat 2 cannot roll for order first: replaying this fails
    expect(
      (await store.appendAction(code, 0, { action: { type: "rollForOrder", seat: 2 } })).ok,
    ).toBe(true);
    const restarted = service(store);
    expect(await restarted.resumeRoom(req(fakeConn()), code, tokens[0] ?? "")).toEqual(
      err("internal"),
    );
    expect(logs.some((l) => l.includes("replay"))).toBe(true);
  });
});

describe("eviction", () => {
  it("drops idle rooms from memory and resumes them from the store", async () => {
    const store = createMemoryStore();
    const svc = service(store, 10);
    const { conns, code, tokens } = await startedGame(svc);
    await drive(svc, conns, () => false, 5);
    const before = conns.map((c) => c.game());
    svc.disconnect(conns[0] as FakeConn);
    svc.disconnect(conns[1] as FakeConn);
    await wait(30);
    expect(svc.loadedRooms()).toBe(1); // seat 2 is still connected
    svc.disconnect(conns[2] as FakeConn);
    await wait(30);
    expect(svc.loadedRooms()).toBe(0);
    const back = fakeConn();
    expect(await svc.resumeRoom(req(back), code, tokens[1] ?? "")).toEqual({ ok: true });
    expect(svc.loadedRooms()).toBe(1);
    expect(back.game()?.view).toEqual(before[1]?.view);
    await wait(30);
    expect(svc.loadedRooms()).toBe(1); // bound again: no eviction
  });

  it("evicts a room loaded by a failed request", async () => {
    const store = createMemoryStore();
    const first = service(store);
    const { code } = await makeLobby(first, ["Ana"]);
    const svc = service(store, 10);
    expect(await svc.resumeRoom(req(fakeConn()), code, "wrong")).toEqual(err("bad_token"));
    expect(svc.loadedRooms()).toBe(1);
    await wait(30);
    expect(svc.loadedRooms()).toBe(0);
  });
});

describe("conflicts", () => {
  it("an append conflict refuses with unavailable, then the room reloads", async () => {
    const store = createMemoryStore();
    const svc = service(store);
    const { conns, code } = await startedGame(svc);
    const move = nextMove(conns);
    if (!move) throw new Error("no move");
    // another process applies the same move behind the service's back
    const sneaky = { ...move.action, seat: move.seat } as Action;
    expect((await store.appendAction(code, 0, { action: sneaky })).ok).toBe(true);
    for (const c of conns) c.clear();
    expect(await svc.gameAction(req(conns[move.seat] as FakeConn), move.action)).toEqual(
      err("unavailable"),
    );
    expect(conns.flatMap((c) => c.sent)).toEqual([]);
    // the next request reloads the stored state (version 1) and applies on top of it
    const next = (move.seat + 1) % 3;
    expect(await svc.gameAction(req(conns[next] as FakeConn), { type: "rollForOrder" })).toEqual({
      ok: true,
    });
    const u = conns[0]?.of("gameUpdate")[0]?.payload;
    expect(u?.version).toBe(2);
    expect(u?.logLength).toBe(3);
    expect((await store.loadRoom(code))?.version).toBe(2);
  });

  it("a lobby meta conflict refuses with unavailable, then the room reloads", async () => {
    const store = createMemoryStore();
    const svc = service(store);
    const { code } = await makeLobby(svc, ["Ana"]);
    const stored = await store.loadRoom(code);
    if (!stored) throw new Error("missing");
    const meta = stored.meta;
    // another process seats Zed
    await store.saveMeta(
      { ...meta, rev: meta.rev + 1, seats: [...meta.seats, { name: "Zed", tokenHash: "00" }] },
      meta.rev,
    );
    expect(await svc.joinRoom(req(fakeConn()), code, "Bo")).toEqual(err("unavailable"));
    expect(await svc.joinRoom(req(fakeConn()), code, "zed")).toEqual(err("bad_name"));
    const c = fakeConn();
    expect(await svc.joinRoom(req(c), code, "Bo")).toEqual({ ok: true });
    expect(c.of("roomJoined")[0]?.payload.seat).toBe(2);
  });
});

describe("lifecycle", () => {
  it("loaded room count and close() are safe to call", () => {
    const svc = service(createMemoryStore());
    expect(svc.loadedRooms()).toBe(0);
    svc.close();
    svc.close();
  });
});
