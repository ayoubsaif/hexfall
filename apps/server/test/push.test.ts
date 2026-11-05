// Web Push in the room layer (openspec change turn-sound-and-push; specs/game-server
// "Push subscriptions", "Connection visibility", "Turn push delivery").
import { createGame, type GameState } from "@hexfall/engine";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { hashToken } from "../src/rooms/codes.ts";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import { fakeClock, fakeConn, makeLobby, req, type FakeConn } from "../src/rooms/testing.ts";
import {
  DEFAULT_PUSH_TTL_S,
  createTurnNotifier,
  newlyWaited,
  ttlSeconds,
} from "../src/push/notify.ts";
import type { PushMessage, PushSender, SendOutcome } from "../src/push/sender.ts";
import {
  MAX_SUBS_PER_SEAT,
  createMemoryPushStore,
  type PushStore,
  type StoredPushSub,
} from "../src/push/store.ts";
import { createMemoryStore } from "../src/store/memory.ts";
import type { RoomMeta } from "../src/store/types.ts";

const services: RoomService[] = [];
afterEach(() => {
  for (const s of services.splice(0)) s.close();
});

function fakeSender(
  outcome: (m: PushMessage) => SendOutcome | Promise<SendOutcome> = () => "sent",
) {
  const sent: PushMessage[] = [];
  const sender: PushSender = {
    async send(m) {
      sent.push(m);
      return outcome(m);
    },
  };
  return { sender, sent };
}

function setup(outcome?: (m: PushMessage) => SendOutcome | Promise<SendOutcome>) {
  const clock = fakeClock();
  const store = createMemoryStore({ now: clock.now });
  const pushStore = createMemoryPushStore();
  const { sender, sent } = fakeSender(outcome);
  const logs: string[] = [];
  const notifier = createTurnNotifier({ store: pushStore, sender, log: (m) => logs.push(m) });
  const svc = createRoomService({
    store,
    now: clock.now,
    timers: clock.timers,
    log: (m) => logs.push(m),
    push: { store: pushStore, notifier },
  });
  services.push(svc);
  return { clock, store, svc, pushStore, notifier, sent, logs };
}

const CONFIG = { seed: "push", mode: "beginner" as const, playerCount: 3 as const };
const TOKENS = ["t0", "t1", "t2"];
const sub = (n: number, lang = "en") => ({
  endpoint: `https://push.example.com/${n}`,
  keys: { p256dh: `p${n}`, auth: `a${n}` },
  lang,
});
const wire = { endpoint: sub(1).endpoint, keys: sub(1).keys };

/** Turn phase, seat 0 active and rolled, nobody owes anything. */
function turnState(): GameState {
  const s = createGame(CONFIG);
  s.phase = { kind: "turn" };
  s.turn = { seat: 0, number: 5, rolled: true, devPlayed: false, dice: [3, 4] };
  return s;
}

async function storedGame(t: ReturnType<typeof setup>, state: GameState, code = "PUSHRM") {
  const meta: RoomMeta = {
    code,
    rev: 0,
    status: "playing",
    createdAt: 0,
    host: 0,
    seats: ["Ana", "Ben", "Cy"].map((name, i) => ({ name, tokenHash: hashToken(TOKENS[i]!) })),
    config: CONFIG,
    turnTimer: "off",
    startedAt: t.clock.now(),
  };
  expect(await t.store.createMeta(meta)).toEqual({ ok: true });
  expect(
    await t.store.appendAction(
      code,
      0,
      { action: { type: "rollForOrder", seat: 0 }, at: t.clock.now() },
      { version: 1, state, anchor: t.clock.now() },
    ),
  ).toEqual({ ok: true });
  const conns: FakeConn[] = TOKENS.map(() => fakeConn());
  for (const [i, c] of conns.entries()) {
    expect(await t.svc.resumeRoom(req(c), code, TOKENS[i]!)).toEqual({ ok: true });
  }
  return { code, conns };
}

describe("push subscriptions", () => {
  it("Not seated: refused with no_seat", async () => {
    const t = setup();
    const r = await t.svc.pushSubscribe(req(fakeConn()), wire, "en");
    expect(r).toEqual({ ok: false, error: { code: "no_seat", message: expect.any(String) } });
  });

  it("Subscribe after join: stored under the room and seat", async () => {
    const t = setup();
    const { code, conns } = await storedGame(t, turnState());
    expect(await t.svc.pushSubscribe(req(conns[2]!), wire, "es")).toEqual({ ok: true });
    expect(await t.pushStore.list(code, hashToken(TOKENS[2]!))).toEqual([{ ...wire, lang: "es" }]);
    expect(await t.svc.pushUnsubscribe(req(conns[2]!), wire.endpoint)).toEqual({ ok: true });
    expect(await t.pushStore.list(code, hashToken(TOKENS[2]!))).toEqual([]);
  });

  it("keeps the newest subscriptions per seat and replaces equal endpoints", async () => {
    const store = createMemoryPushStore();
    for (let i = 0; i < MAX_SUBS_PER_SEAT + 2; i++) await store.add("R", "h", sub(i));
    await store.add("R", "h", sub(MAX_SUBS_PER_SEAT + 1, "es"));
    const list = await store.list("R", "h");
    expect(list).toHaveLength(MAX_SUBS_PER_SEAT);
    expect(list.at(-1)).toEqual(sub(MAX_SUBS_PER_SEAT + 1, "es"));
    expect(list.filter((s) => s.endpoint === sub(MAX_SUBS_PER_SEAT + 1).endpoint)).toHaveLength(1);
  });

  it("forgets a seat that leaves the lobby and the room when it is deleted", async () => {
    const t = setup();
    const { code, conns, tokens } = await makeLobby(t.svc, ["Ana", "Ben"]);
    await t.svc.pushSubscribe(req(conns[0]!), wire, "en");
    await t.svc.pushSubscribe(req(conns[1]!), wire, "en");
    await t.svc.leaveRoom(req(conns[1]!));
    await t.notifier.idle();
    await Promise.resolve();
    expect(await t.pushStore.list(code, hashToken(tokens[1]!))).toEqual([]);
    expect(await t.pushStore.list(code, hashToken(tokens[0]!))).toHaveLength(1);
    await t.svc.leaveRoom(req(conns[0]!));
    await Promise.resolve();
    expect(await t.pushStore.list(code, hashToken(tokens[0]!))).toEqual([]);
  });
});

describe("turn push delivery", () => {
  it("Turn starts while away: one push of kind turn per stored subscription", async () => {
    const t = setup();
    const { code, conns } = await storedGame(t, turnState());
    await t.svc.pushSubscribe(req(conns[1]!), wire, "es");
    t.svc.disconnect(conns[1]!);
    expect(await t.svc.gameAction(req(conns[0]!), { type: "endTurn" })).toEqual({ ok: true });
    await t.notifier.idle();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toMatchObject({
      sub: { endpoint: wire.endpoint },
      payload: { v: 1, kind: "turn", room: code, lang: "es" },
      ttlSeconds: DEFAULT_PUSH_TTL_S,
      topic: code,
    });
  });

  it("Visible player gets no push", async () => {
    const t = setup();
    const { conns } = await storedGame(t, turnState());
    await t.svc.pushSubscribe(req(conns[1]!), wire, "en");
    await t.svc.gameAction(req(conns[0]!), { type: "endTurn" });
    await t.notifier.idle();
    expect(t.sent).toEqual([]);
  });

  it("Hidden tab: connected but hidden gets a push", async () => {
    const t = setup();
    const { conns } = await storedGame(t, turnState());
    await t.svc.pushSubscribe(req(conns[1]!), wire, "en");
    t.svc.setVisibility(conns[1]!, false);
    await t.svc.gameAction(req(conns[0]!), { type: "endTurn" });
    await t.notifier.idle();
    expect(t.sent.map((m) => m.payload.kind)).toEqual(["turn"]);
  });

  it("A resume counts as visible again", async () => {
    const t = setup();
    const { code, conns } = await storedGame(t, turnState());
    await t.svc.pushSubscribe(req(conns[1]!), wire, "en");
    t.svc.setVisibility(conns[1]!, false);
    const again = fakeConn();
    await t.svc.resumeRoom(req(again), code, TOKENS[1]!);
    await t.svc.gameAction(req(conns[0]!), { type: "endTurn" });
    await t.notifier.idle();
    expect(t.sent).toEqual([]);
  });

  it("Expired subscription: deleted after a 410", async () => {
    const t = setup(() => "gone");
    const { code, conns } = await storedGame(t, turnState());
    await t.svc.pushSubscribe(req(conns[1]!), wire, "en");
    t.svc.disconnect(conns[1]!);
    await t.svc.gameAction(req(conns[0]!), { type: "endTurn" });
    await t.notifier.idle();
    expect(t.sent).toHaveLength(1);
    expect(await t.pushStore.list(code, hashToken(TOKENS[1]!))).toEqual([]);
  });

  it("Push service down: the game goes on", async () => {
    const t = setup(() => new Promise<SendOutcome>(() => {}));
    const { conns } = await storedGame(t, turnState());
    await t.svc.pushSubscribe(req(conns[1]!), wire, "en");
    t.svc.disconnect(conns[1]!);
    expect(await t.svc.gameAction(req(conns[0]!), { type: "endTurn" })).toEqual({ ok: true });
    expect(conns[0]!.game()?.view.turn.seat).toBe(1);
    expect(await t.svc.gameAction(req(conns[2]!), { type: "endTurn" })).toMatchObject({
      ok: false,
    });
  });

  it("a failing push store is only logged", async () => {
    const broken: PushStore = {
      ...createMemoryPushStore(),
      list: () => Promise.reject(new Error("redis down")),
    };
    const { sender, sent } = fakeSender();
    const logs: string[] = [];
    const n = createTurnNotifier({ store: broken, sender, log: (m) => logs.push(m) });
    const before = turnState();
    const after = turnState();
    after.turn = { seat: 1, number: 6, rolled: false, devPlayed: false, dice: null };
    n.waitsChanged({
      room: "R",
      before,
      after,
      holders: ["h0", "h1", "h2"],
      visible: () => false,
      deadline: null,
      now: 0,
    });
    await n.idle();
    expect(sent).toEqual([]);
    expect(logs.join("\n")).toContain("redis down");
  });
});

describe("who is newly waited for", () => {
  it("Discard after a 7: only the discarders, not the roller", () => {
    const before = turnState();
    before.turn = { ...before.turn, rolled: false, dice: null };
    const after = turnState();
    after.phase = { kind: "discard", owed: [4, 0, 5] };
    expect(newlyWaited(before, after)).toEqual([2]);
  });

  it("everyone waited for at game start; nobody once the game has ended", () => {
    const start = createGame({ ...CONFIG, mode: "variable" });
    expect(newlyWaited(null, start)).toEqual([0, 1, 2]);
    const ended = turnState();
    ended.phase = { kind: "ended" };
    expect(newlyWaited(turnState(), ended)).toEqual([]);
  });

  it("discard push uses kind discard", async () => {
    const pushStore = createMemoryPushStore();
    const subs: StoredPushSub = sub(7);
    await pushStore.add("R", "h2", subs);
    const { sender, sent } = fakeSender();
    const n = createTurnNotifier({ store: pushStore, sender });
    const before = turnState();
    const after = turnState();
    after.phase = { kind: "discard", owed: [0, 0, 5] };
    for (const r of ["ore", "wool", "grain"] as const) {
      after.players[2]!.resources[r] += 3;
      after.bank[r] -= 3;
    }
    n.waitsChanged({
      room: "R",
      before,
      after,
      holders: ["h0", "h1", "h2"],
      visible: () => false,
      deadline: 1_090_000,
      now: 1_000_000,
    });
    await n.idle();
    expect(sent.map((m) => [m.payload.kind, m.ttlSeconds])).toEqual([["discard", 90]]);
  });

  it("TTL follows the deadline, capped at an hour", () => {
    expect(ttlSeconds(null, 0)).toBe(DEFAULT_PUSH_TTL_S);
    expect(ttlSeconds(30_000, 0)).toBe(30);
    expect(ttlSeconds(10_000, 0)).toBe(30);
    expect(ttlSeconds(10_000_000, 0)).toBe(DEFAULT_PUSH_TTL_S);
  });
});
