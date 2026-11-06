import type { GameEvent } from "@hexfall/engine";
import {
  AVATAR_IDS,
  CloseCode,
  PROTOCOL_VERSION,
  type AvatarId,
  type EarlyResult,
} from "@hexfall/protocol";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { act, createRoom, setSessionApi } from "../../src/net/actions.ts";
import { createAddress, type AddressEnv } from "../../src/net/address.ts";
import {
  createSeatStorage,
  type SeatStorage,
  type StorageLike,
} from "../../src/net/seatStorage.ts";
import { cleanName, SEAT_LOST_NOTICE, type SessionController } from "../../src/net/session.ts";
import { createSessionConnection } from "../../src/net/useConnection.ts";
import type { Connection } from "../../src/net/connection.ts";
import { initialConnectionState, useConnectionStore } from "../../src/store/connection.ts";
import { resetGame, useGameStore } from "../../src/store/game.ts";
import { resetRoom, useRoomStore } from "../../src/store/room.ts";
import { chooseBuild, resetUi, useUiStore } from "../../src/store/ui.ts";
import { seen, setupState } from "../game/fixtures.ts";
import { FakeClock, FakeSocket } from "./fakes.ts";

// ---- fakes

class MapStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

function addressEnv(search = ""): AddressEnv {
  const e: AddressEnv = {
    location: { origin: "https://hexfall.test", pathname: "/", search, hash: "" },
    history: {
      replaceState(_d: unknown, _u: string, url?: string) {
        e.location.search = new URL(url ?? "", "https://hexfall.test").search;
      },
    },
  };
  return e;
}

let clock: FakeClock;
let storage: MapStorage;
let env: AddressEnv;
let seats: SeatStorage;
let conn: Connection;
let session: SessionController;
let seq = 0;
let logs: string[];

let seatedCalls = 0;

function boot(search = "") {
  env = addressEnv(search);
  seats = createSeatStorage(storage);
  const built = createSessionConnection(
    {
      serverUrl: "ws://test",
      clientVersion: "1.0.0",
      WebSocket: FakeSocket,
      timers: clock,
      now: clock.now,
      random: () => 0.5,
      log: () => {},
    },
    {
      seats,
      address: createAddress(env),
      timers: clock,
      log: (m) => logs.push(m),
      onSeated: () => void seatedCalls++,
    },
  );
  conn = built.connection;
  session = built.session;
  setSessionApi(session);
  conn.start();
}

const frame = (type: string, payload: unknown) => ({
  v: PROTOCOL_VERSION,
  type,
  seq: seq++,
  payload,
});
const send = (type: string, payload: unknown) => FakeSocket.last().serverSend(frame(type, payload));

/** Opens the current socket and delivers `welcome`. */
function welcome() {
  const s = FakeSocket.last();
  s.serverOpen();
  s.serverSend(
    frame("welcome", { serverVersion: "9", protocolVersion: PROTOCOL_VERSION, pushKey: null }),
  );
}

/** Client messages sent on the current socket, without hello/ping. */
function sent(s = FakeSocket.last()) {
  return s.sentMessages().filter((m) => m.type !== "hello" && m.type !== "ping");
}

const seatsInfo = (n: number) =>
  ["Ana", "Ben", "Cy", "Di"]
    .slice(0, n)
    .map((name, seat) => ({
      seat,
      name,
      connected: true,
      bot: false,
      avatar: AVATAR_IDS[seat] as AvatarId,
    }));

function roomState(
  status: "lobby" | "playing" | "paused" | "ended" = "lobby",
  n = 3,
  host = 0,
  extra: { pausedAt?: number | null; result?: EarlyResult | null } = {},
) {
  send("roomState", {
    room: "K7QX2M",
    status,
    host,
    seats: seatsInfo(n),
    pausedAt: null,
    result: null,
    ...extra,
  });
}

function snapshot(version = 10) {
  const { view, legal } = seen(setupState(), 0);
  const log: GameEvent[] = [{ type: "gameCreated", playerCount: 4, mode: "beginner" }];
  send("gameSnapshot", { version, view: { ...view, log }, legal, timer: null });
  return { view, legal };
}

function update(version: number, events: GameEvent[], logLength: number) {
  const { view, legal } = seen(setupState(), 0);
  send("gameUpdate", {
    version,
    view: { ...view, log: [] },
    events,
    logLength,
    legal,
    timer: null,
  });
}

const ended: GameEvent = { type: "turnEnded", seat: 0 };
const started: GameEvent = { type: "turnStarted", seat: 1, number: 2 };

beforeEach(() => {
  FakeSocket.instances = [];
  clock = new FakeClock();
  storage = new MapStorage();
  logs = [];
  seq = 0;
  useConnectionStore.setState({ ...initialConnectionState });
  resetGame();
  resetRoom({ prefillRoom: null, notice: null });
  resetUi();
});

afterEach(() => {
  conn?.close();
  setSessionApi();
});

// ---- tests

describe("names", () => {
  it("trims and checks 1–20 characters", () => {
    expect(cleanName("  Ana ")).toBe("Ana");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("x".repeat(20))).toHaveLength(20);
    expect(cleanName("x".repeat(21))).toBeNull();
  });
});

describe("seated hook (turn-sound-and-push)", () => {
  it("calls onSeated after every roomJoined, with the room store updated", () => {
    seatedCalls = 0;
    boot();
    welcome();
    send("roomJoined", { room: "ABCD", seat: 2, token: "tok" });
    expect(seatedCalls).toBe(1);
    expect(useRoomStore.getState()).toMatchObject({ room: "ABCD", seat: 2 });
    send("roomJoined", { room: "ABCD", seat: 2 });
    expect(seatedCalls).toBe(2);
  });
});

describe("start screen", () => {
  it("creates a room and shows the lobby (spec: Create a room)", () => {
    boot();
    welcome();
    expect(sent()).toEqual([]);
    expect(createRoom("  Ana ")).toBe(true);
    expect(sent()).toMatchObject([{ type: "createRoom", payload: { name: "Ana" } }]);
    expect(useRoomStore.getState().pending).toBe("create");

    send("roomJoined", { room: "K7QX2M", seat: 0, token: "secret" });
    roomState("lobby", 1);
    expect(useRoomStore.getState()).toMatchObject({
      room: "K7QX2M",
      seat: 0,
      host: 0,
      status: "lobby",
      pending: null,
    });
    expect(useRoomStore.getState().seats[0]).toEqual({
      seat: 0,
      name: "Ana",
      connected: true,
      bot: false,
      avatar: "villager-beard",
    });
    expect(seats.token("K7QX2M")).toBe("secret");
    expect(seats.lastRoom()).toBe("K7QX2M");
    expect(env.location.search).toBe("?room=K7QX2M");
    expect(session.inviteLink()).toBe("https://hexfall.test/?room=K7QX2M");
  });

  it("plays solo: seats the bots and starts once the room is ours", () => {
    boot();
    welcome();
    expect(session.playSolo("Ana", 2)).toBe(true);
    expect(sent()).toMatchObject([{ type: "createRoom", payload: { name: "Ana" } }]);
    send("roomJoined", { room: "K7QX2M", seat: 0, token: "secret" });
    expect(sent().map((m) => m.type)).toEqual(["createRoom", "addBot", "addBot", "startGame"]);
    expect(sent().at(-1)).toMatchObject({ payload: { mode: "variable", turnTimer: "off" } });
    // A later room (e.g. a rejoin) does not start by itself.
    send("roomJoined", { room: "ZZZZZZ", seat: 1, token: "t2" });
    expect(sent()).toHaveLength(4);
  });

  it("a failed solo create does not start a game on the next room", () => {
    boot();
    welcome();
    session.playSolo("Ana", 3);
    send("error", { code: "unavailable", message: "busy" });
    send("roomJoined", { room: "K7QX2M", seat: 0, token: "secret" });
    expect(sent().map((m) => m.type)).toEqual(["createRoom"]);
  });

  it("refuses a name that is too long (spec: Name too long)", () => {
    boot();
    welcome();
    expect(createRoom("x".repeat(25))).toBe(false);
    expect(session.joinRoom("ABCDEF", "")).toBe(false);
    expect(sent()).toEqual([]);
  });

  it("refuses room requests while offline (spec: Offline)", () => {
    boot();
    expect(createRoom("Ana")).toBe(false);
    welcome();
    FakeSocket.last().serverClose(1006);
    expect(useConnectionStore.getState().status).toBe("reconnecting");
    expect(createRoom("Ana")).toBe(false);
  });

  it("joins with a room code in any case", () => {
    boot();
    welcome();
    expect(session.joinRoom(" k7qx2m ", "Ben")).toBe(true);
    expect(sent()).toMatchObject([{ type: "joinRoom", payload: { room: "K7QX2M", name: "Ben" } }]);
    // A second request while one is pending is not sent.
    expect(session.joinRoom("K7QX2M", "Ben")).toBe(false);
  });

  it("prefills the join form from an invite link (spec: Open an invite link)", () => {
    boot("?room=k7qx2m");
    expect(useRoomStore.getState().prefillRoom).toBe("K7QX2M");
    welcome();
    expect(sent()).toEqual([]);
    expect(useRoomStore.getState()).toMatchObject({ room: null, prefillRoom: "K7QX2M" });
  });

  it("shows server errors next to the request and keeps the form (spec: Room full, Name taken)", () => {
    boot();
    welcome();
    session.joinRoom("K7QX2M", "Ben");
    send("error", { code: "room_full", message: "room is full" });
    expect(useRoomStore.getState()).toMatchObject({
      pending: null,
      error: { request: "join", code: "room_full" },
    });
    session.joinRoom("K7QX2M", "ana");
    expect(useRoomStore.getState().error).toBeNull();
    send("error", { code: "bad_name", message: "taken" });
    expect(useRoomStore.getState().error).toMatchObject({ request: "join", code: "bad_name" });
  });
});

describe("lobby", () => {
  function inLobby(n = 3) {
    boot();
    welcome();
    createRoom("Ana");
    send("roomJoined", { room: "K7QX2M", seat: 0, token: "secret" });
    roomState("lobby", n);
  }

  it("starts with the chosen mode and an optional starting seat (spec: Host starts)", () => {
    inLobby();
    expect(session.startGame("beginner")).toBe(true);
    expect(sent().at(-1)).toMatchObject({ type: "startGame", payload: { mode: "beginner" } });
    expect(sent().at(-1)?.payload).not.toHaveProperty("startingPlayer");
    send("error", { code: "not_enough_players", message: "need 3" });
    expect(useRoomStore.getState().error).toMatchObject({ request: "start" });
    session.startGame("variable", 2);
    expect(sent().at(-1)).toMatchObject({ payload: { mode: "variable", startingPlayer: 2 } });
  });

  it("follows host changes from roomState (spec: Host changes)", () => {
    inLobby();
    roomState("lobby", 2, 1);
    expect(useRoomStore.getState().host).toBe(1);
  });

  it("leaves: forgets the seat and returns to the start screen", () => {
    inLobby();
    expect(session.leaveRoom()).toBe(true);
    expect(sent().at(-1)).toMatchObject({ type: "leaveRoom", payload: {} });
    send("roomLeft", { room: "K7QX2M" });
    expect(useRoomStore.getState()).toMatchObject({ room: null, seat: null, seats: [] });
    expect(seats.token("K7QX2M")).toBeNull();
    expect(env.location.search).toBe("");
  });

  it("start delivers the game", () => {
    inLobby();
    session.startGame("variable");
    roomState("playing");
    snapshot(0);
    expect(useGameStore.getState()).toMatchObject({ version: 0, source: "snapshot" });
    expect(useGameStore.getState().view?.phase.kind).toBe("setup");
  });
});

describe("resume", () => {
  it("resumes from the address after a reload (spec: Reload mid-game)", () => {
    storage.setItem("hexfall.seats", JSON.stringify({ K7QX2M: "secret" }));
    boot("?room=K7QX2M");
    welcome();
    expect(sent()).toEqual([
      expect.objectContaining({ type: "resumeRoom", payload: { room: "K7QX2M", token: "secret" } }),
    ]);
    send("roomJoined", { room: "K7QX2M", seat: 2 });
    roomState("playing");
    snapshot(12);
    expect(useRoomStore.getState()).toMatchObject({ room: "K7QX2M", seat: 2, status: "playing" });
    expect(useGameStore.getState()).toMatchObject({ version: 12, source: "snapshot" });
    expect(useGameStore.getState().log).toHaveLength(1);
    expect(seats.token("K7QX2M")).toBe("secret"); // no token on resume: kept
  });

  it("resumes the last room when the address has none", () => {
    const s = createSeatStorage(storage);
    s.save("K7QX2M", "secret");
    s.setLastRoom("K7QX2M");
    boot();
    welcome();
    expect(sent()[0]).toMatchObject({ type: "resumeRoom", payload: { room: "K7QX2M" } });
  });

  it("an invite to another room does not resume the last room", () => {
    const s = createSeatStorage(storage);
    s.save("AAAAAA", "old");
    s.setLastRoom("AAAAAA");
    boot("?room=BBBBBB");
    welcome();
    expect(sent()).toEqual([]);
    expect(useRoomStore.getState().prefillRoom).toBe("BBBBBB");
  });

  it("resumes on its own after a server restart (spec: Server restart)", () => {
    boot();
    welcome();
    createRoom("Ana");
    send("roomJoined", { room: "K7QX2M", seat: 0, token: "secret" });
    roomState("playing");
    snapshot(5);
    FakeSocket.last().serverClose(CloseCode.ServerRestarting);
    clock.advance(10_000);
    expect(FakeSocket.instances).toHaveLength(2);
    welcome();
    expect(sent()[0]).toMatchObject({
      type: "resumeRoom",
      payload: { room: "K7QX2M", token: "secret" },
    });
  });

  it("forgets a stale token (spec: Stale token)", () => {
    storage.setItem("hexfall.seats", JSON.stringify({ K7QX2M: "old" }));
    boot("?room=K7QX2M");
    welcome();
    send("error", { code: "bad_token", message: "no such seat" });
    expect(seats.token("K7QX2M")).toBeNull();
    expect(useRoomStore.getState()).toMatchObject({ room: null, notice: SEAT_LOST_NOTICE });
    expect(useGameStore.getState().view).toBeNull();
    expect(env.location.search).toBe("");
  });

  it("goes back to a lobby without a game view", () => {
    storage.setItem("hexfall.seats", JSON.stringify({ K7QX2M: "s" }));
    boot("?room=K7QX2M");
    welcome();
    snapshot(3);
    roomState("lobby");
    expect(useGameStore.getState().view).toBeNull();
  });
});

describe("replaced connection", () => {
  it("stops, then Play here reconnects and resumes (spec: Second tab)", () => {
    boot();
    welcome();
    createRoom("Ana");
    send("roomJoined", { room: "K7QX2M", seat: 0, token: "secret" });
    FakeSocket.last().serverClose(CloseCode.Replaced);
    expect(useConnectionStore.getState().status).toBe("replaced");
    clock.advance(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    session.playHere();
    expect(FakeSocket.instances).toHaveLength(2);
    welcome();
    expect(sent()[0]).toMatchObject({ type: "resumeRoom", payload: { room: "K7QX2M" } });
  });
});

describe("game store", () => {
  function inGame() {
    storage.setItem("hexfall.seats", JSON.stringify({ K7QX2M: "s" }));
    boot("?room=K7QX2M");
    welcome();
    send("roomJoined", { room: "K7QX2M", seat: 0 });
    roomState("playing", 4);
    snapshot(10);
  }

  it("applies newer updates in order (spec: Update applied in order)", () => {
    inGame();
    update(11, [ended, started], 3);
    const g = useGameStore.getState();
    expect(g.version).toBe(11);
    expect(g.log).toHaveLength(3);
    expect(g.lastEvents).toEqual([ended, started]);
    expect(g.source).toBe("update");
  });

  it("ignores old or repeated updates (spec: Old update ignored)", () => {
    inGame();
    update(11, [ended], 2);
    update(11, [ended], 3);
    update(9, [ended], 3);
    expect(useGameStore.getState()).toMatchObject({ version: 11 });
    expect(useGameStore.getState().log).toHaveLength(2);
  });

  it("reconnects and resumes on a log gap (spec: Log gap)", () => {
    inGame();
    const first = FakeSocket.last();
    update(12, [ended], 5);
    expect(useGameStore.getState().version).toBe(10);
    expect(first.closedWith).toBe(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(logs.some((l) => l.includes("log gap"))).toBe(true);
    welcome();
    expect(sent()[0]).toMatchObject({ type: "resumeRoom" });
    snapshot(12);
    expect(useGameStore.getState().version).toBe(12);
  });

  it("clears the game and intent on leaving after game over (back to start)", () => {
    inGame();
    chooseBuild("road");
    session.backToStart();
    expect(useGameStore.getState().view).toBeNull();
    expect(useRoomStore.getState().room).toBeNull();
    expect(useUiStore.getState().build).toBeNull();
    expect(seats.token("K7QX2M")).toBeNull();
    expect(env.location.search).toBe("");
    expect(FakeSocket.instances).toHaveLength(2);
    welcome();
    expect(sent()).toEqual([]); // fresh, unseated connection
    expect(createRoom("Ana")).toBe(true);
  });
});

describe("sending game actions", () => {
  function inGame() {
    storage.setItem("hexfall.seats", JSON.stringify({ K7QX2M: "s" }));
    boot("?room=K7QX2M");
    welcome();
    send("roomJoined", { room: "K7QX2M", seat: 0 });
    snapshot(10);
  }

  it("blocks a double send until the reply (spec: No double roll)", () => {
    inGame();
    expect(act({ type: "rollDice" })).toBe(true);
    expect(act({ type: "rollDice" })).toBe(false);
    expect(sent().filter((m) => m.type === "gameAction")).toHaveLength(1);
    expect(sent().at(-1)).toMatchObject({ payload: { action: { type: "rollDice" } } });
    expect(useGameStore.getState().inFlight).toBe(true);
    update(11, [ended], 2);
    expect(useGameStore.getState().inFlight).toBe(false);
    expect(act({ type: "endTurn" })).toBe(true);
  });

  it("a rejection unlocks and keeps the view", () => {
    inGame();
    const before = useGameStore.getState().view;
    act({ type: "endTurn" });
    send("actionRejected", { code: "must_roll_first", message: "roll first" });
    const g = useGameStore.getState();
    expect(g.inFlight).toBe(false);
    expect(g.view).toBe(before);
    expect(g.rejection).toMatchObject({ code: "must_roll_first", message: "roll first", id: 1 });
    act({ type: "endTurn" });
    send("actionRejected", { code: "must_roll_first", message: "roll first" });
    expect(useGameStore.getState().rejection?.id).toBe(2);
  });

  it("a server error on an action unlocks too", () => {
    inGame();
    act({ type: "rollDice" });
    send("error", { code: "unavailable", message: "try later" });
    expect(useGameStore.getState()).toMatchObject({
      inFlight: false,
      rejection: { code: "unavailable" },
    });
  });

  it("a disconnect or the 10 s safety timeout unlocks", () => {
    inGame();
    act({ type: "rollDice" });
    clock.advance(10_000);
    expect(useGameStore.getState().inFlight).toBe(false);
    expect(logs.some((l) => l.includes("no reply"))).toBe(true);

    act({ type: "rollDice" });
    FakeSocket.last().serverClose(1006);
    expect(useGameStore.getState().inFlight).toBe(false);
    expect(act({ type: "rollDice" })).toBe(false); // offline
  });
});

describe("pause, resume and early end (pause-and-resume-games)", () => {
  function inGame() {
    storage.setItem("hexfall.seats", JSON.stringify({ K7QX2M: "s" }));
    boot("?room=K7QX2M");
    welcome();
    send("roomJoined", { room: "K7QX2M", seat: 0 });
    roomState("playing", 4);
    snapshot(10);
  }

  it("pause sends pauseGame, waits for the paused room state, and freezes controls", () => {
    inGame();
    expect(useGameStore.getState().legal).not.toBeNull();
    expect(session.pauseGame()).toBe(true);
    expect(sent().at(-1)).toMatchObject({ type: "pauseGame", payload: {} });
    expect(useRoomStore.getState().pending).toBe("pause");
    expect(session.pauseGame()).toBe(false); // one at a time
    roomState("paused", 4, 0, { pausedAt: 123 });
    expect(useRoomStore.getState()).toMatchObject({
      status: "paused",
      pausedAt: 123,
      pending: null,
    });
    expect(useGameStore.getState()).toMatchObject({ legal: null, timer: null });
    // Snapshots while paused keep the controls off.
    snapshot(10);
    expect(useGameStore.getState().legal).toBeNull();
    expect(act({ type: "rollDice" })).toBe(true); // the server answers game_paused
  });

  it("resume clears the pause and the next snapshot brings the moves back", () => {
    inGame();
    roomState("paused", 4, 0, { pausedAt: 5 });
    expect(session.resumeGame()).toBe(true);
    expect(sent().at(-1)).toMatchObject({ type: "resumeGame" });
    roomState("playing", 4);
    expect(useRoomStore.getState()).toMatchObject({ pausedAt: null, pending: null });
    snapshot(10);
    expect(useGameStore.getState().legal).not.toBeNull();
  });

  it("a refused host request shows its error", () => {
    inGame();
    session.endGame();
    send("error", { code: "not_host", message: "only the host" });
    expect(useRoomStore.getState()).toMatchObject({
      pending: null,
      error: { request: "end", code: "not_host" },
    });
  });

  it("early end stores the result and freezes controls", () => {
    inGame();
    expect(session.endGame()).toBe(true);
    expect(sent().at(-1)).toMatchObject({ type: "endGame" });
    const result: EarlyResult = {
      reason: "host",
      at: 9,
      winners: [0, 2],
      scores: [0, 1, 2, 3].map((seat) => ({ seat, vp: seat === 1 ? 3 : 5, hiddenVp: 0 })),
    };
    roomState("ended", 4, 0, { result });
    expect(useRoomStore.getState()).toMatchObject({ status: "ended", result, pending: null });
    expect(useGameStore.getState().legal).toBeNull();
  });
});

describe("saved games (saved-games)", () => {
  const info = (rooms: unknown[]) => send("seatsInfo", { rooms });
  const entry = (room: string, status: string, seat = 0) => ({
    room,
    status,
    seat,
    host: 0,
    names: ["Ana", "Ben", "Cy"],
    bots: [false, false, false],
    turn: null,
    pausedAt: status === "paused" ? 1 : null,
    expiresAt: 2,
    createdAt: 0,
    startedAt: status === "lobby" ? null : 1,
    lastActiveAt: status === "lobby" ? null : 1,
  });

  it("looks up every saved seat and keeps only rooms that still exist", async () => {
    const s = createSeatStorage(storage, () => 100);
    s.save("AAAAAA", "ta");
    s.save("BBBBBB", "tb");
    s.save("CCCCCC", "tc");
    s.save("DDDDDD", "td");
    // Old plain-string values still count, with usedAt 0.
    const raw = JSON.parse(storage.getItem("hexfall.seats")!) as Record<string, unknown>;
    storage.setItem("hexfall.seats", JSON.stringify({ ...raw, EEEEEE: "te" }));
    storage.setItem("hexfall.lastRoom", "");
    boot();
    welcome();
    expect(session.lookupSeats()).toBe(true);
    const msg = sent().at(-1);
    expect(msg?.type).toBe("lookupSeats");
    const asked = (msg?.payload as { seats: { room: string }[] } | undefined)?.seats ?? [];
    expect(asked.map((x) => x.room).sort()).toEqual([
      "AAAAAA",
      "BBBBBB",
      "CCCCCC",
      "DDDDDD",
      "EEEEEE",
    ]);
    const { useSavedGamesStore } = await import("../../src/store/savedGames.ts");
    expect(useSavedGamesStore.getState().loading).toBe(true);
    info([
      entry("AAAAAA", "lobby"),
      { room: "BBBBBB", status: "gone" },
      entry("CCCCCC", "ended"),
      entry("DDDDDD", "paused", 1),
      entry("EEEEEE", "playing"),
    ]);
    const st = useSavedGamesStore.getState();
    expect(st.loading).toBe(false);
    expect(st.entries.map((e) => e.room)).toEqual(["DDDDDD", "EEEEEE", "AAAAAA"]);
    expect(seats.token("BBBBBB")).toBeNull();
    expect(seats.token("CCCCCC")).toBeNull();
    expect(seats.token("AAAAAA")).toBe("ta");

    // Remove forgets locally only.
    session.forgetGame("aaaaaa");
    expect(seats.token("AAAAAA")).toBeNull();
    expect(useSavedGamesStore.getState().entries.map((e) => e.room)).toEqual(["DDDDDD", "EEEEEE"]);
    expect(sent().at(-1)?.type).toBe("lookupSeats");

    // Continue resumes with the stored token.
    expect(session.continueGame("DDDDDD")).toBe(true);
    expect(sent().at(-1)).toMatchObject({
      type: "resumeRoom",
      payload: { room: "DDDDDD", token: "td" },
    });
    send("roomJoined", { room: "DDDDDD", seat: 1 });
    send("roomState", {
      room: "DDDDDD",
      status: "paused",
      host: 0,
      seats: seatsInfo(3),
      pausedAt: 1,
      result: null,
    });
    expect(useRoomStore.getState()).toMatchObject({ room: "DDDDDD", status: "paused" });
  });

  it("sends nothing without saved seats, and stops loading on an error", async () => {
    const { useSavedGamesStore } = await import("../../src/store/savedGames.ts");
    boot();
    welcome();
    expect(session.lookupSeats()).toBe(false);
    expect(sent()).toEqual([]);
    seats.save("AAAAAA", "ta");
    seats.setLastRoom(null);
    expect(session.lookupSeats()).toBe(true);
    send("error", { code: "unavailable", message: "later" });
    expect(useSavedGamesStore.getState().loading).toBe(false);
  });

  it("End from the list sends the stored token and drops the ended room", async () => {
    const { useSavedGamesStore } = await import("../../src/store/savedGames.ts");
    boot();
    welcome();
    seats.save("AAAAAA", "ta");
    seats.save("BBBBBB", "tb");
    seats.setLastRoom(null);
    session.lookupSeats();
    info([entry("AAAAAA", "playing"), entry("BBBBBB", "paused")]);
    expect(session.endSavedGame("aaaaaa")).toBe(true);
    expect(sent().at(-1)).toMatchObject({
      type: "endSavedGame",
      payload: { room: "AAAAAA", token: "ta" },
    });
    expect(useSavedGamesStore.getState().ending).toBe("AAAAAA");
    expect(session.endSavedGame("BBBBBB")).toBe(false); // one at a time
    info([entry("AAAAAA", "ended")]);
    expect(useSavedGamesStore.getState()).toMatchObject({ ending: null, error: null });
    expect(useSavedGamesStore.getState().entries.map((e) => e.room)).toEqual(["BBBBBB"]);
    expect(seats.token("AAAAAA")).toBeNull();
    expect(seats.token("BBBBBB")).toBe("tb");
    // A refused end keeps the entry and shows the error.
    session.endSavedGame("BBBBBB");
    send("error", { code: "not_host", message: "only the host" });
    expect(useSavedGamesStore.getState()).toMatchObject({
      ending: null,
      error: { room: "BBBBBB", code: "not_host" },
    });
    expect(useSavedGamesStore.getState().entries.map((e) => e.room)).toEqual(["BBBBBB"]);
  });
});
