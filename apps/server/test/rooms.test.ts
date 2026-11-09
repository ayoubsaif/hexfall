import { afterEach, describe, expect, it } from "vite-plus/test";
import type { GameEvent } from "@hexfall/engine";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import { drive, fakeConn, makeLobby, req, type FakeConn } from "../src/rooms/testing.ts";
import { createMemoryStore, type MemoryStore } from "../src/store/memory.ts";

let svc: RoomService;
let store: MemoryStore;
const logs: string[] = [];

function fresh() {
  store = createMemoryStore();
  logs.length = 0;
  svc = createRoomService({ store, log: (m) => logs.push(m) });
  return svc;
}

afterEach(() => svc?.close());

const lastRoomState = (c: FakeConn) => c.of("roomState").at(-1)?.payload;
const err = (code: string) => ({ ok: false, error: { code, message: expect.any(String) } });

async function started(names: readonly string[], mode: "beginner" | "variable" = "variable") {
  fresh();
  const lobby = await makeLobby(svc, names);
  const host = lobby.conns[0] as FakeConn;
  expect(await svc.startGame(req(host), { mode })).toEqual({ ok: true });
  return lobby;
}

describe("lobby", () => {
  it("creates a room with the creator as seat 0 and host", async () => {
    fresh();
    const c = fakeConn();
    const r = req(c);
    expect(await svc.createRoom(r, "  Ana ")).toEqual({ ok: true });
    expect(c.sent.map((m) => m.type)).toEqual(["roomJoined", "roomState"]);
    const joined = c.of("roomJoined")[0];
    expect(joined?.re).toBe(r.seq);
    expect(joined?.payload.seat).toBe(0);
    expect(joined?.payload.token).toEqual(expect.any(String));
    expect(joined?.payload.room).toMatch(/^[A-Z2-9]{6}$/);
    expect(lastRoomState(c)).toEqual({
      room: joined?.payload.room,
      status: "lobby",
      host: 0,
      seats: [{ seat: 0, name: "Ana", connected: true, bot: false, avatar: "villager-beard" }],
      pausedAt: null,
      result: null,
    });
    expect(svc.loadedRooms()).toBe(1);
    // the stored meta holds a hash, never the token
    const stored = await store.loadRoom(joined?.payload.room ?? "");
    expect(stored?.meta.seats[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(joined?.payload.token);
  });

  it("rejects a bad creator name", async () => {
    fresh();
    const c = fakeConn();
    expect(await svc.createRoom(req(c), "")).toEqual(err("bad_name"));
    expect(await svc.createRoom(req(c), "x".repeat(21))).toEqual(err("bad_name"));
    expect(c.sent).toEqual([]);
  });

  it("seats joiners in order, case-insensitive code, and tells everyone", async () => {
    fresh();
    const { conns } = await makeLobby(svc, ["Ana", "Ben", "Cy"]);
    const [ana, ben, cy] = conns as [FakeConn, FakeConn, FakeConn];
    expect(ben.of("roomJoined")[0]?.payload.seat).toBe(1);
    expect(cy.of("roomJoined")[0]?.payload.seat).toBe(2);
    for (const c of conns) {
      expect(lastRoomState(c)?.seats.map((s) => s.name)).toEqual(["Ana", "Ben", "Cy"]);
    }
    expect(ana.of("roomState")).toHaveLength(3);
  });

  it("refuses a seventh player, duplicate names and unknown codes", async () => {
    fresh();
    const { code } = await makeLobby(svc, ["Ana", "Ben"]);
    expect(await svc.joinRoom(req(fakeConn()), code, "ana")).toEqual(err("bad_name"));
    expect(await svc.joinRoom(req(fakeConn()), code, "BEN ")).toEqual(err("bad_name"));
    expect(await svc.joinRoom(req(fakeConn()), code, "Cy")).toEqual({ ok: true });
    expect(await svc.joinRoom(req(fakeConn()), code, "Dee")).toEqual({ ok: true });
    expect(await svc.joinRoom(req(fakeConn()), code, "Eve")).toEqual({ ok: true });
    expect(await svc.joinRoom(req(fakeConn()), code, "Fay")).toEqual({ ok: true });
    const seventh = fakeConn();
    expect(await svc.joinRoom(req(seventh), code, "Gus")).toEqual(err("room_full"));
    expect(seventh.sent).toEqual([]);
    expect(await svc.joinRoom(req(fakeConn()), "ZZZZZZ", "Eve")).toEqual(err("room_not_found"));
    expect(await svc.joinRoom(req(fakeConn()), "nope", "Eve")).toEqual(err("room_not_found"));
  });

  it("refuses to join after the start", async () => {
    const { code } = await started(["Ana", "Ben", "Cy"]);
    expect(await svc.joinRoom(req(fakeConn()), code, "Dee")).toEqual(err("game_started"));
  });

  it("closes up seats and hands host to the new seat 0 when the host leaves", async () => {
    fresh();
    const { conns, code } = await makeLobby(svc, ["Ana", "Ben", "Cy"]);
    const [ana, ben, cy] = conns as [FakeConn, FakeConn, FakeConn];
    const r = req(ana);
    expect(await svc.leaveRoom(r)).toEqual({ ok: true });
    expect(ana.sent.at(-1)).toEqual({ type: "roomLeft", payload: { room: code }, re: r.seq });
    const expected = {
      room: code,
      status: "lobby",
      host: 0,
      seats: [
        { seat: 0, name: "Ben", connected: true, bot: false, avatar: "herbalist" },
        { seat: 1, name: "Cy", connected: true, bot: false, avatar: "farmer" },
      ],
      pausedAt: null,
      result: null,
    };
    expect(lastRoomState(ben)).toEqual(expected);
    expect(lastRoomState(cy)).toEqual(expected);
    // Ben is now host and can act as seat 0; Ana is unbound
    expect(await svc.leaveRoom(req(ana))).toEqual(err("no_seat"));
    expect(await svc.startGame(req(cy), { mode: "variable" })).toEqual(err("not_host"));
    // tokens moved with the seats: Cy's token resumes seat 1
    const stored = await store.loadRoom(code);
    expect(stored?.meta.seats.map((s) => s.name)).toEqual(["Ben", "Cy"]);
    expect(stored?.meta.host).toBe(0);
  });

  it("a non-host leaving keeps the host", async () => {
    fresh();
    const { conns } = await makeLobby(svc, ["Ana", "Ben", "Cy"]);
    const [ana, ben] = conns as [FakeConn, FakeConn, FakeConn];
    expect(await svc.leaveRoom(req(ben))).toEqual({ ok: true });
    expect(lastRoomState(ana)?.host).toBe(0);
    expect(lastRoomState(ana)?.seats.map((s) => s.name)).toEqual(["Ana", "Cy"]);
  });

  it("deletes the room when the last player leaves", async () => {
    fresh();
    const { conns, code } = await makeLobby(svc, ["Ana"]);
    expect(await svc.leaveRoom(req(conns[0] as FakeConn))).toEqual({ ok: true });
    expect(svc.loadedRooms()).toBe(0);
    expect(await store.loadRoom(code)).toBeNull();
    expect(await svc.joinRoom(req(fakeConn()), code, "Ben")).toEqual(err("room_not_found"));
  });

  it("leaving after the start keeps the seat as an open bot seat (leave-game)", async () => {
    const { conns } = await started(["Ana", "Ben", "Cy"]);
    expect(await svc.leaveRoom(req(conns[1] as FakeConn))).toEqual({ ok: true });
    const seats = lastRoomState(conns[0] as FakeConn)?.seats;
    expect(seats).toHaveLength(3);
    expect(seats?.[1]).toMatchObject({ bot: true, open: true });
  });
});

describe("avatars", () => {
  it("assigns the first free avatar by default and honors a free request", async () => {
    fresh();
    const a = fakeConn();
    await svc.createRoom(req(a), "Ana");
    const code = a.of("roomJoined")[0]?.payload.room ?? "";
    const b = fakeConn();
    await svc.joinRoom(req(b), code, "Ben", "baker");
    const c = fakeConn();
    await svc.joinRoom(req(c), code, "Cy");
    const seats = lastRoomState(c)?.seats.map((s: { avatar: string }) => s.avatar);
    expect(seats).toEqual(["villager-beard", "baker", "herbalist"]);
  });

  it("joins with the first free avatar when the request is taken", async () => {
    fresh();
    const a = fakeConn();
    await svc.createRoom(req(a), "Ana", "farmer");
    const code = a.of("roomJoined")[0]?.payload.room ?? "";
    const b = fakeConn();
    expect(await svc.joinRoom(req(b), code, "Ben", "farmer")).toEqual({ ok: true });
    expect(lastRoomState(b)?.seats[1]?.avatar).toBe("villager-beard");
  });

  it("setAvatar changes it, broadcasts and frees the old one", async () => {
    fresh();
    const lobby = await makeLobby(svc, ["Ana", "Ben"]);
    const [a, b] = lobby.conns as FakeConn[];
    expect(await svc.setAvatar(req(b as FakeConn), "fisher")).toEqual({ ok: true });
    expect(lastRoomState(a as FakeConn)?.seats[1]?.avatar).toBe("fisher");
    expect(await svc.setAvatar(req(a as FakeConn), "fisher")).toEqual(err("avatar_taken"));
    expect(await svc.setAvatar(req(a as FakeConn), "herbalist")).toEqual({ ok: true });
  });

  it("gives bots the first free avatar", async () => {
    fresh();
    const lobby = await makeLobby(svc, ["Ana"]);
    const a = lobby.conns[0] as FakeConn;
    await svc.addBot(req(a));
    expect(lastRoomState(a)?.seats.map((s: { avatar: string }) => s.avatar)).toEqual([
      "villager-beard",
      "herbalist",
    ]);
  });

  it("is locked after the game starts", async () => {
    const lobby = await started(["Ana", "Ben", "Cy"]);
    expect(await svc.setAvatar(req(lobby.conns[0] as FakeConn), "fisher")).toEqual(
      err("game_started"),
    );
  });

  it("resolves avatars for seats stored without one", async () => {
    const { resolveAvatars } = await import("../src/rooms/avatars.ts");
    expect(resolveAvatars([{}, { avatar: "villager-beard" }, {}])).toEqual([
      "herbalist",
      "villager-beard",
      "farmer",
    ]);
  });
});

describe("start", () => {
  it("is host-only, needs 3-6 players and a valid starting seat", async () => {
    fresh();
    const { conns } = await makeLobby(svc, ["Ana", "Ben"]);
    const [ana, ben] = conns as [FakeConn, FakeConn];
    const cy = fakeConn();
    expect(await svc.joinRoom(req(cy), ana.of("roomJoined")[0]?.payload.room ?? "", "Cy")).toEqual({
      ok: true,
    });
    expect(await svc.startGame(req(ben), { mode: "variable" })).toEqual(err("not_host"));
    expect(await svc.startGame(req(ana), { mode: "variable", startingPlayer: 3 })).toEqual(
      err("bad_frame"),
    );
    expect(await svc.startGame(req(fakeConn()), { mode: "variable" })).toEqual(err("no_seat"));
    expect(await svc.startGame(req(ana), { mode: "beginner", startingPlayer: 2 })).toEqual({
      ok: true,
    });
    expect(await svc.startGame(req(ana), { mode: "beginner" })).toEqual(err("game_started"));
  });

  it("starts six seats on the large board with the chosen victory target", async () => {
    fresh();
    const { conns, code } = await makeLobby(svc, ["Ana", "Ben", "Cy", "Dee", "Eve", "Fay"]);
    const ana = conns[0] as FakeConn;
    const avatars = lastRoomState(ana)?.seats.map((s) => s.avatar) ?? [];
    expect(new Set(avatars).size).toBe(6);
    expect(await svc.startGame(req(ana), { mode: "beginner", victoryTarget: 12 })).toEqual({
      ok: true,
    });
    const view = ana.game()?.view;
    expect(view?.players).toHaveLength(6);
    expect(view?.board.layout).toBe("large");
    expect(view?.victoryTarget).toBe(12);
    const meta = (await store.loadRoom(code))?.meta;
    expect(meta?.config).toMatchObject({ mode: "variable", playerCount: 6, victoryTarget: 12 });
  });

  it("refuses a victory target outside 8 to 15", async () => {
    fresh();
    const { conns } = await makeLobby(svc, ["Ana", "Ben", "Cy"]);
    const ana = conns[0] as FakeConn;
    for (const victoryTarget of [7, 16, 9.5]) {
      expect(await svc.startGame(req(ana), { mode: "variable", victoryTarget })).toEqual(
        err("bad_frame"),
      );
    }
    expect(await svc.startGame(req(ana), { mode: "variable" })).toEqual({ ok: true });
    expect(ana.game()?.view.victoryTarget).toBe(10);
  });

  it("sends every seat its own snapshot in the roll-for-order phase", async () => {
    fresh();
    const { conns, code } = await makeLobby(svc, ["Ana", "Ben", "Cy"]);
    for (const c of conns) c.clear();
    const r = req(conns[0] as FakeConn);
    expect(await svc.startGame(r, { mode: "variable" })).toEqual({ ok: true });
    for (const [seat, c] of conns.entries()) {
      expect(c.sent.map((m) => m.type)).toEqual(["roomState", "gameSnapshot"]);
      expect(lastRoomState(c)?.status).toBe("playing");
      const snap = c.of("gameSnapshot")[0];
      expect(snap?.re).toBe(seat === 0 ? r.seq : undefined);
      expect(snap?.payload.version).toBe(0);
      expect(snap?.payload.view.viewer).toBe(seat);
      expect(snap?.payload.view.playerCount).toBe(3);
      expect(snap?.payload.view.phase.kind).toBe("rollForOrder");
      // seats roll for order one after another, starting with seat 0
      expect(snap?.payload.legal.rollForOrder).toBe(seat === 0);
      expect(snap?.payload.view.players[seat]?.resources).toBeDefined();
      expect(snap?.payload.view.players[(seat + 1) % 3]?.resources).toBeUndefined();
    }
    const stored = await store.loadRoom(code);
    expect(stored?.meta.status).toBe("playing");
    expect(stored?.meta.config).toMatchObject({ mode: "variable", playerCount: 3 });
    expect(stored?.meta.config?.seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it("an outage refuses the start and changes nothing", async () => {
    fresh();
    const { conns } = await makeLobby(svc, ["Ana", "Ben", "Cy"]);
    for (const c of conns) c.clear();
    store.setAvailable(false);
    expect(await svc.startGame(req(conns[0] as FakeConn), { mode: "variable" })).toEqual(
      err("unavailable"),
    );
    expect(conns.flatMap((c) => c.sent)).toEqual([]);
    store.setAvailable(true);
    expect(await svc.startGame(req(conns[0] as FakeConn), { mode: "variable" })).toEqual({
      ok: true,
    });
  });
});

describe("actions", () => {
  it("fills in the bound seat: acting for another seat is impossible", async () => {
    const { conns } = await started(["Ana", "Ben", "Cy"]);
    // reach the first normal turn
    await drive(svc, conns, () => (conns[0]?.game()?.view.phase.kind ?? "") === "turn", 200);
    const active = conns[0]?.game()?.view.turn.seat ?? 0;
    const other = conns[(active + 1) % 3] as FakeConn;
    for (const c of conns) c.clear();
    const r = await svc.gameAction(req(other), { type: "endTurn" });
    expect(r).toEqual({
      ok: false,
      rejected: { code: "not_your_turn", message: expect.any(String) },
    });
    expect(conns.flatMap((c) => c.sent)).toEqual([]);
  });

  it("an accepted action updates every seat with version+1, and `re` for the actor", async () => {
    const { conns } = await started(["Ana", "Ben", "Cy"]);
    const before = conns[0]?.game()?.version ?? -1;
    for (const c of conns) c.clear();
    const r = req(conns[0] as FakeConn);
    expect(await svc.gameAction(r, { type: "rollForOrder" })).toEqual({ ok: true });
    for (const [seat, c] of conns.entries()) {
      expect(c.sent).toHaveLength(1);
      const u = c.of("gameUpdate")[0];
      expect(u?.re).toBe(seat === 0 ? r.seq : undefined);
      expect(u?.payload.version).toBe(before + 1);
      expect(u?.payload.view.log).toEqual([]);
      expect(u?.payload.view.viewer).toBe(seat);
      expect(u?.payload.events).toEqual([
        { type: "orderRolled", seat: 0, dice: expect.any(Array) },
      ]);
      expect(u?.payload.logLength).toBe(2);
      expect(u?.payload.legal.rollForOrder).toBe(seat === 1);
    }
  });

  it("rejects game actions in the lobby with wrong_phase", async () => {
    fresh();
    const { conns } = await makeLobby(svc, ["Ana"]);
    expect(await svc.gameAction(req(conns[0] as FakeConn), { type: "rollDice" })).toEqual({
      ok: false,
      rejected: { code: "wrong_phase", message: expect.any(String) },
    });
    expect(await svc.gameAction(req(fakeConn()), { type: "rollDice" })).toEqual(err("no_seat"));
  });

  it("applies concurrent actions one at a time in arrival order", async () => {
    const { conns } = await started(["Ana", "Ben", "Cy"]);
    const results = await Promise.all(
      conns.map((c) => svc.gameAction(req(c), { type: "rollForOrder" })),
    );
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    const ana = conns[0] as FakeConn;
    expect(ana.of("gameUpdate").map((u) => u.payload.version)).toEqual([1, 2, 3]);
    const rolled = ana
      .of("gameUpdate")
      .flatMap((u) => u.payload.events)
      .filter((e) => e.type === "orderRolled")
      .map((e) => e.seat);
    expect(rolled).toEqual([0, 1, 2]);
  });

  it("legal moves include roll-dice for the active player after setup", async () => {
    const { conns } = await started(["Ana", "Ben", "Cy"]);
    await drive(svc, conns, () => (conns[0]?.game()?.view.phase.kind ?? "") === "turn", 200);
    const active = conns[0]?.game()?.view.turn.seat ?? -1;
    const last = (conns[active] as FakeConn).of("gameUpdate").at(-1);
    expect(last?.payload.legal.rollDice).toBe(true);
  });

  it("an outage refuses the action, sends nothing and keeps the state", async () => {
    const { conns, code } = await started(["Ana", "Ben", "Cy"]);
    for (const c of conns) c.clear();
    store.setAvailable(false);
    expect(await svc.gameAction(req(conns[0] as FakeConn), { type: "rollForOrder" })).toEqual(
      err("unavailable"),
    );
    expect(conns.flatMap((c) => c.sent)).toEqual([]);
    store.setAvailable(true);
    expect(await svc.gameAction(req(conns[0] as FakeConn), { type: "rollForOrder" })).toEqual({
      ok: true,
    });
    expect(conns[0]?.of("gameUpdate")[0]?.payload.version).toBe(1);
    expect((await store.loadRoom(code))?.version).toBe(1);
  });
});

describe("redaction", () => {
  it("a steal shows the resource to thief and victim only", async () => {
    const { conns } = await started(["Ana", "Ben", "Cy", "Dee"]);
    const isSteal = (e: GameEvent) => e.type === "stole" && e.thief !== e.victim;
    /** Version of the first update where a thief saw the card it took. */
    const stealVersion = () =>
      conns
        .flatMap((c, seat) =>
          c
            .of("gameUpdate")
            .filter((u) =>
              u.payload.events.some(
                (e) => e.type === "stole" && e.thief === seat && e.victim !== seat && e.resource,
              ),
            ),
        )
        .map((u) => u.payload.version)[0];
    // the autopilot never builds, so hands grow and a 7 with a victim comes quickly
    await drive(svc, conns, () => stealVersion() !== undefined, 3000);
    const version = stealVersion();
    expect(version).toBeDefined();
    const steals = conns.map((c) => {
      const u = c.of("gameUpdate").find((m) => m.payload.version === version);
      return u?.payload.events.find(isSteal) as Extract<GameEvent, { type: "stole" }>;
    });
    const { thief, victim } = steals[0] as Extract<GameEvent, { type: "stole" }>;
    const real = steals[thief]?.resource ?? null;
    expect(real).not.toBeNull();
    for (const [seat, e] of steals.entries()) {
      expect(e.thief).toBe(thief);
      expect(e.victim).toBe(victim);
      if (seat === thief || seat === victim) expect(e.resource).toBe(real);
      else expect(e.resource).toBeNull();
    }
    // hands are never shown for other seats
    for (const [seat, c] of conns.entries()) {
      const view = c.game()?.view;
      for (const p of view?.players ?? []) {
        if (p.seat !== seat) expect(p.resources).toBeUndefined();
      }
    }
  });
});

describe("presence", () => {
  it("disconnect marks the seat, keeps it, and never acts for the player", async () => {
    const { conns, code, tokens } = await started(["Ana", "Ben", "Cy"]);
    const isDiscard = () => conns[0]?.game()?.view.phase.kind === "discard";
    await drive(svc, conns, isDiscard, 3000);
    expect(isDiscard()).toBe(true);
    const phase = conns[0]?.game()?.view.phase;
    if (phase?.kind !== "discard") throw new Error("not in discard");
    const owing = phase.owed.findIndex((n) => n > 0);
    const gone = conns[owing] as FakeConn;
    const versionBefore = (await store.loadRoom(code))?.version;
    for (const c of conns) c.clear();
    svc.disconnect(gone);
    expect(gone.sent).toEqual([]);
    for (const [seat, c] of conns.entries()) {
      if (seat === owing) continue;
      expect(lastRoomState(c)?.seats[owing]?.connected).toBe(false);
      expect(c.of("gameUpdate")).toEqual([]);
    }
    // nothing moves on: the active player still cannot proceed past the discard
    for (const seat of [0, 1, 2]) {
      if (seat === owing) continue;
      const r = await svc.gameAction(req(conns[seat] as FakeConn), { type: "endTurn" });
      expect(r.ok).toBe(false);
    }
    expect((await store.loadRoom(code))?.version).toBe(versionBefore);
    // the player returns and discards
    const back = fakeConn();
    expect(await svc.resumeRoom(req(back), code, tokens[owing] ?? "")).toEqual({ ok: true });
    expect(back.game()?.view.phase.kind).toBe("discard");
    const legal = back.game()?.legal;
    expect(legal?.discard).toBeGreaterThan(0);
    for (const [seat, c] of conns.entries()) {
      if (seat !== owing) expect(lastRoomState(c)?.seats[owing]?.connected).toBe(true);
    }
  });
});
