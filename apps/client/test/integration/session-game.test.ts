// Task 5.2: the client session driven by a real engine game behind a fake server.
// The fake server applies the client's gameAction messages with the real reducer and
// answers with real per-seat views, so stores, currentPick and status are checked
// against true engine output through setup, a 7 with a discard, a Knight and a
// maritime trade.
import {
  applyAction,
  createGame,
  legalActions,
  playerView,
  type Action,
  type GameState,
  type Seat,
} from "@hexfall/engine";
import { AVATAR_IDS, PROTOCOL_VERSION, type AvatarId } from "@hexfall/protocol";
import { act, createElement, Fragment } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { currentPick } from "../../src/game/pick.ts";
import { controlsOf, statusOf } from "../../src/game/status.ts";
import { namesFrom } from "../../src/hud/names.ts";
import { act as sendAction, setSessionApi } from "../../src/net/actions.ts";
import { createAddress, type AddressEnv } from "../../src/net/address.ts";
import type { Connection } from "../../src/net/connection.ts";
import { createSeatStorage, type StorageLike } from "../../src/net/seatStorage.ts";
import { createSessionConnection } from "../../src/net/useConnection.ts";
import { initialConnectionState, useConnectionStore } from "../../src/store/connection.ts";
import { resetGame, useGameStore } from "../../src/store/game.ts";
import { resetRoom, useRoomStore } from "../../src/store/room.ts";
import { chooseBuild, resetUi, useUiStore } from "../../src/store/ui.ts";
import { OffersTray } from "../../src/hud/OffersTray.tsx";
import { TradePanel } from "../../src/hud/TradePanel.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { give, playState, setupState } from "../game/fixtures.ts";
import { byText, click, mount, type Mounted } from "../hud/helpers.tsx";
import { FakeClock, FakeSocket } from "../net/fakes.ts";
import { fixedT } from "../../src/i18n/index.ts";

const tEn = fixedT("en");

const ME: Seat = 0;
const ROOM = "K7QX2M";

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

function addressEnv(): AddressEnv {
  const e: AddressEnv = {
    location: { origin: "https://hexfall.test", pathname: "/", search: "", hash: "" },
    history: {
      replaceState(_d: unknown, _u: string, url?: string) {
        e.location.search = new URL(url ?? "", "https://hexfall.test").search;
      },
    },
  };
  return e;
}

/** Plays the server side for seat ME: real reducer, real redacted views. */
class FakeServer {
  state: GameState;
  version = 0;
  private seq = 0;
  private read = 0;
  rejections = 0;

  constructor(state: GameState) {
    this.state = state;
  }

  private frame(type: string, payload: unknown) {
    FakeSocket.last().serverSend({ v: PROTOCOL_VERSION, type, seq: this.seq++, payload });
  }

  welcome() {
    const s = FakeSocket.last();
    s.serverOpen();
    this.frame("welcome", {
      serverVersion: "test",
      protocolVersion: PROTOCOL_VERSION,
      pushKey: null,
    });
  }

  joined() {
    this.frame("roomJoined", { room: ROOM, seat: ME, token: "tok-0" });
    this.frame("roomState", {
      room: ROOM,
      status: "playing",
      host: 0,
      seats: ["Ana", "Ben", "Cy"].map((name, seat) => ({
        seat,
        name,
        connected: true,
        bot: false,
        avatar: AVATAR_IDS[seat] as AvatarId,
      })),
      pausedAt: null,
      result: null,
    });
  }

  snapshot() {
    this.frame("gameSnapshot", {
      version: this.version,
      view: playerView(this.state, ME),
      legal: legalActions(this.state, ME),
      timer: null,
    });
  }

  /** Applies an action from any seat and broadcasts the update to ME. */
  apply(action: Action): boolean {
    const before = playerView(this.state, ME).log.length;
    const r = applyAction(this.state, action);
    if (!r.ok) {
      if ("seat" in action && action.seat === ME) {
        this.rejections++;
        this.frame("actionRejected", { code: r.code, message: r.message });
      }
      return false;
    }
    this.state = r.state;
    this.version++;
    const view = playerView(this.state, ME);
    this.frame("gameUpdate", {
      version: this.version,
      view: { ...view, log: [] },
      events: view.log.slice(before),
      logLength: view.log.length,
      legal: legalActions(this.state, ME),
      timer: null,
    });
    return true;
  }

  /** Processes the gameAction messages the client sent since the last pump. */
  pump(): number {
    const msgs = FakeSocket.last().sentMessages();
    let n = 0;
    for (; this.read < msgs.length; this.read++) {
      const m = msgs[this.read]!;
      if (m.type !== "gameAction") continue;
      const action = (m.payload as { action: Omit<Action, "seat"> }).action;
      this.apply({ ...action, seat: ME } as Action);
      n++;
    }
    return n;
  }
}

let clock: FakeClock;
let conn: Connection;
let server: FakeServer;

function boot(state: GameState) {
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
      seats: createSeatStorage(new MapStorage()),
      address: createAddress(addressEnv()),
      timers: clock,
      log: () => {},
    },
  );
  conn = built.connection;
  setSessionApi(built.session);
  conn.start();
  server = new FakeServer(state);
  server.welcome();
  server.joined();
  server.snapshot();
}

/** What the board would offer right now, from the stores. */
function pickNow() {
  const g = useGameStore.getState();
  const ui = useUiStore.getState();
  return currentPick({
    view: g.view,
    legal: g.legal,
    build: ui.build,
    inFlight: g.inFlight,
    victimHex: ui.victimHex,
  });
}

/** The HUD status line and controls, from the stores (as the HUD computes them). */
function hud() {
  const g = useGameStore.getState();
  const names = namesFrom(useRoomStore.getState().seats, tEn);
  return {
    status: statusOf(g.view!, names, tEn),
    controls: controlsOf(g.view, g.legal, g.inFlight),
  };
}

function expectStatus(text: RegExp, yourMove: boolean) {
  const { status } = hud();
  expect(status.text).toMatch(text);
  expect(status.yourMove).toBe(yourMove);
}

/** Asserts the client mirrors the server exactly for seat ME. */
function expectInSync() {
  const g = useGameStore.getState();
  const truth = playerView(server.state, ME);
  expect(g.version).toBe(server.version);
  expect(g.inFlight).toBe(false);
  expect(g.log).toEqual(truth.log);
  expect({ ...g.view!, log: [] }).toEqual({ ...truth, log: [] });
  expect(g.legal).toEqual(legalActions(server.state, ME));
}

/** Like a board click: send the action for the first target of the current pick. */
function pickFirst(): number {
  const pick = pickNow();
  if (!pick) throw new Error("no pick");
  const id = [...pick.targets][0]!;
  const field = pick.target === "vertex" ? "vertex" : "edge";
  expect(sendAction({ type: pick.kind, [field]: id } as never)).toBe(true);
  expect(useGameStore.getState().inFlight).toBe(true);
  expect(pickNow()).toBeNull(); // nothing pickable while in flight
  server.pump();
  return id;
}

/** An RNG state whose next rollDice (from this state) totals `total`. */
function rngForRoll(state: GameState, total: number): GameState["rng"] {
  for (let seed = 1; seed < 5000; seed++) {
    const rng = createGame({ seed, playerCount: 3, mode: "beginner" }).rng;
    const trial = structuredClone(state);
    trial.rng = structuredClone(rng);
    const r = applyAction(trial, { type: "rollDice", seat: trial.turn.seat });
    if (r.ok && r.state.turn.dice && r.state.turn.dice[0] + r.state.turn.dice[1] === total) {
      return structuredClone(rng);
    }
  }
  throw new Error(`no seed rolls ${total}`);
}

beforeEach(() => {
  FakeSocket.instances = [];
  clock = new FakeClock();
  useConnectionStore.setState({ ...initialConnectionState });
  resetGame();
  resetRoom({ prefillRoom: null, notice: null });
  resetUi();
});

afterEach(() => {
  conn?.close();
  setSessionApi();
});

describe("client session over a real engine game", () => {
  it("setup, a 7 with a discard, a Knight and a maritime trade stay in sync", () => {
    boot(setupState(3, 7));
    expect(useRoomStore.getState()).toMatchObject({ room: ROOM, seat: ME, status: "playing" });
    expectInSync();

    // ---- Setup snake: 0,1,2,2,1,0. The client places through currentPick; others via the server.
    const order = [0, 1, 2, 2, 1, 0];
    for (const seat of order) {
      if (seat === ME) {
        expectStatus(/^Place your (first|second) settlement$/, true);
        expect(pickNow()?.kind).toBe("placeSettlement");
        pickFirst();
        expectInSync();
        expect(pickNow()?.kind).toBe("placeRoad");
        expectStatus(/^Place your (first|second) road$/, true);
        pickFirst();
        expectInSync();
      } else {
        expect(pickNow()).toBeNull(); // not my placement
        expectStatus(new RegExp(`^${["Ana", "Ben", "Cy"][seat]} is placing a settlement$`), false);
        const l = legalActions(server.state, seat);
        server.apply({ type: "placeSettlement", seat, vertex: l.placeSettlement[0]! });
        const l2 = legalActions(server.state, seat);
        server.apply({ type: "placeRoad", seat, edge: l2.placeRoad[0]! });
        expectInSync();
      }
    }
    const s = useGameStore.getState();
    expect(s.view!.phase.kind).toBe("turn");
    expect(s.view!.turn.seat).toBe(ME);
    expect(s.legal!.rollDice).toBe(true);
    expectStatus(/^Roll the dice$/, true);
    expect(hud().controls).toMatchObject({ rollDice: true, endTurn: false, buildRoad: false });
    const startingCards = s.view!.players[ME]!.resourceCount;

    // ---- Server-side preparation (as if earlier turns happened), then a fresh snapshot.
    const prep = structuredClone(server.state);
    give(prep, ME, { wool: 8, ore: 4, grain: 4 });
    prep.players[ME]!.devCards.push("knight");
    prep.rng = rngForRoll(prep, 7);
    server.state = prep;
    server.version += 1;
    server.snapshot();
    expectInSync();
    const handBefore = startingCards + 16;
    expect(useGameStore.getState().view!.players[ME]!.resourceCount).toBe(handBefore);

    // ---- Roll a 7: the client must discard half.
    expect(sendAction({ type: "rollDice" })).toBe(true);
    expect(sendAction({ type: "rollDice" })).toBe(false); // double send blocked
    server.pump();
    expectInSync();
    const owed = Math.floor(handBefore / 2);
    expect(useGameStore.getState().view!.phase.kind).toBe("discard");
    expect(useGameStore.getState().legal!.discard).toBe(owed);
    expectStatus(new RegExp(`^A 7! Discard ${owed} cards$`), true);
    expect(hud().controls.endTurn).toBe(false);
    expect(pickNow()).toBeNull();

    // Others may owe cards too; they discard via the server.
    for (const seat of [1, 2]) {
      const n = legalActions(server.state, seat).discard;
      if (n > 0) {
        const res = playerView(server.state, seat).players[seat]!.resources!;
        const cards: Record<string, number> = {};
        let left = n;
        for (const [r, c] of Object.entries(res)) {
          const take = Math.min(c, left);
          if (take > 0) cards[r] = take;
          left -= take;
        }
        server.apply({ type: "discard", seat, cards });
      }
    }
    // The client keeps its wool (for the maritime trade) and discards other cards first.
    const mine = useGameStore.getState().view!.players[ME]!.resources!;
    const cards: Record<string, number> = {};
    let left = owed;
    for (const r of ["grain", "ore", "brick", "lumber", "wool"] as const) {
      const take = Math.min(mine[r], left);
      if (take > 0) cards[r] = take;
      left -= take;
    }
    sendAction({ type: "discard", cards });
    server.pump();
    expectInSync();
    expect(useGameStore.getState().view!.players[ME]!.resourceCount).toBe(handBefore - owed);

    // ---- Move the robber through the pick.
    expectStatus(/^Move the robber: pick a hex$/, true);
    const robberPick = pickNow();
    expect(robberPick?.kind).toBe("moveRobber");
    const option = useGameStore.getState().legal!.moveRobber[0]!;
    expect(robberPick!.targets.has(option.hex)).toBe(true);
    sendAction({ type: "moveRobber", hex: option.hex, victim: option.victims[0] ?? null });
    server.pump();
    expectInSync();
    expect(useGameStore.getState().view!.robber).toBe(option.hex);
    expect(useGameStore.getState().view!.phase.kind).toBe("turn");

    // ---- Knight (bought on an earlier turn, so playable now) leads to another robber pick.
    expect(useGameStore.getState().legal!.playDevCard).toContain("knight");
    sendAction({ type: "playKnight" });
    server.pump();
    expectInSync();
    expect(pickNow()?.kind).toBe("moveRobber");
    expectStatus(/^Move the robber: pick a hex$/, true);
    expect(pickNow()!.targets.has(option.hex)).toBe(false); // must move to another hex
    const knightHex = useGameStore.getState().legal!.moveRobber[0]!;
    sendAction({ type: "moveRobber", hex: knightHex.hex, victim: knightHex.victims[0] ?? null });
    server.pump();
    expectInSync();
    expect(useGameStore.getState().view!.players[ME]!.knights).toBe(1);
    expect(useGameStore.getState().legal!.playDevCard).toEqual([]); // one card per turn
    expectStatus(/^Your turn: trade, build or end your turn$/, true);
    expect(hud().controls).toMatchObject({ endTurn: true, maritime: true, devCards: [] });

    // ---- Maritime trade at the rate the server gives.
    const legal = useGameStore.getState().legal!;
    expect(legal.maritime).not.toBeNull();
    const held = useGameStore.getState().view!.players[ME]!.resources!;
    const give4 = (["wool", "ore", "grain", "brick", "lumber"] as const).find(
      (r) => held[r] >= legal.maritime![r],
    );
    expect(give4).toBeDefined();
    const get = give4 === "brick" ? "lumber" : "brick";
    const rate = legal.maritime![give4!];
    sendAction({ type: "maritimeTrade", give: give4!, get, count: 1 });
    server.pump();
    expectInSync();
    const after = useGameStore.getState().view!.players[ME]!.resources!;
    expect(after[give4!]).toBe(held[give4!] - rate);
    expect(after[get]).toBe(held[get] + 1);

    // ---- A rejected action leaves the view unchanged and shows the rule error.
    const v = useGameStore.getState().version;
    sendAction({ type: "buildCity", vertex: 0 });
    server.pump();
    expect(server.rejections).toBe(1);
    expect(useGameStore.getState().version).toBe(v);
    expect(useGameStore.getState().rejection?.code).toBeTypeOf("string");
    expect(useGameStore.getState().inFlight).toBe(false);

    // ---- A chosen build that is legal shows the right pick, then end the turn.
    chooseBuild("road");
    const roadPick = pickNow();
    if (useGameStore.getState().legal!.buildRoad.length > 0) {
      expect(roadPick?.kind).toBe("buildRoad");
    } else {
      expect(roadPick).toBeNull();
    }
    sendAction({ type: "endTurn" });
    server.pump();
    expectInSync();
    expect(useGameStore.getState().view!.turn.seat).toBe(1);
    expect(pickNow()).toBeNull();
    expectStatus(/^Ben is about to roll$/, false);
    expect(hud().controls).toMatchObject({ rollDice: false, endTurn: false, maritime: false });
  });
});

describe("player trade over a real engine game", () => {
  let m: Mounted | null = null;
  afterEach(() => {
    m?.unmount();
    m = null;
  });

  const btn = (label: string) =>
    document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const entries = () => [...document.querySelectorAll<HTMLElement>('[data-testid="offer"]')];
  const pump = () => act(() => void server.pump());
  const serverApply = (a: Action) => act(() => void server.apply(a));

  it("offer, a decline, a counter accepted, and offers gone at turn end", () => {
    const s = playState({ seat: ME, playerCount: 3 });
    give(s, 0, { ore: 2, brick: 1 });
    give(s, 1, { wool: 3 });
    give(s, 2, { grain: 1 });
    act(() => boot(s));
    m = mount(
      createElement(Fragment, null, [
        createElement(ActionButtons, { key: "a" }),
        createElement(OffersTray, { key: "o" }),
        createElement(TradePanel, { key: "t" }),
      ]),
    );

    // ---- Offer 1 ore for 1 wool to both opponents through the composer.
    click(btn("Trade with players"));
    click(btn("Give one more Ore"));
    click(btn("Ask for one more Wool"));
    click(byText(document.body, "button", "Send offer"));
    pump();
    expectInSync();
    expect(server.state.offers).toHaveLength(1);
    const mine = entries()[0]!;
    expect(mine.textContent).toContain("Your offer");
    expect(mine.querySelector('[data-recipient="1"]')?.textContent).toBe("Ben: deciding");

    // ---- Cy declines; Ben counters with 2 wool for 1 ore.
    serverApply({ type: "rejectTrade", seat: 2, offerId: server.state.offers[0]!.id });
    expect(entries()[0]!.querySelector('[data-recipient="2"]')?.textContent).toBe("Cy: declined");
    serverApply({ type: "proposeTrade", seat: 1, give: { wool: 2 }, get: { ore: 1 }, to: [ME] });
    expectInSync();
    const counter = entries().find((e) => e.textContent?.includes("Ben offers"))!;
    expect(counter.querySelector('[data-testid="offer-text"]')?.textContent).toBe(
      "You give 1 ore, you get 2 wool.",
    );

    // ---- Accept the counter: cards move, the counter closes, the first offer stays open.
    click(byText(counter, "button", "Accept"));
    pump();
    expectInSync();
    expect(server.state.players[ME]!.resources).toMatchObject({ ore: 1, wool: 2 });
    expect(server.state.players[1]!.resources).toMatchObject({ ore: 1, wool: 1 });
    expect(entries()).toHaveLength(1);
    expect(useGameStore.getState().log.map((e) => e.type)).toContain("tradeAccepted");

    // ---- Ending the turn withdraws the open offer.
    click(btn("End turn"));
    pump();
    expectInSync();
    expect(server.state.offers).toEqual([]);
    expect(entries()).toHaveLength(0);
  });
});
