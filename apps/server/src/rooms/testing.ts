// Test helpers for the rooms layer: fake connections and a simple autoplayer that
// picks moves from the legal actions a seat last received. Not used in production.
import type { LegalActions, PlayerView, Resource } from "@hexfall/engine";
import type { ClientAction } from "@hexfall/protocol";
import type { Conn, Outgoing, RoomService, TimerFns } from "./service.ts";

export interface FakeConn extends Conn {
  sent: Outgoing[];
  closed: { code: number; reason: string } | null;
  /** Messages of one type, oldest first. */
  of<T extends Outgoing["type"]>(type: T): Extract<Outgoing, { type: T }>[];
  /** Latest full view and legal moves, from gameSnapshot/gameUpdate messages. */
  game(): { version: number; view: PlayerView; legal: LegalActions } | null;
  clear(): void;
}

let nextId = 0;

export function fakeConn(id = `c${++nextId}`): FakeConn {
  const conn: FakeConn = {
    id,
    sent: [],
    closed: null,
    send(m) {
      conn.sent.push(m);
    },
    close(code, reason) {
      conn.closed = { code, reason };
    },
    of(type) {
      return conn.sent.filter((m) => m.type === type) as never;
    },
    game() {
      let out: { version: number; view: PlayerView; legal: LegalActions } | null = null;
      for (const m of conn.sent) {
        if (m.type === "gameSnapshot") out = { ...m.payload };
        if (m.type === "gameUpdate" && out) {
          out = {
            version: m.payload.version,
            view: { ...m.payload.view, log: [...out.view.log, ...m.payload.events] },
            legal: m.payload.legal,
          };
        }
      }
      return out;
    },
    clear() {
      conn.sent.length = 0;
    },
  };
  return conn;
}

/** A simple deterministic move for `seat`, or null if it has nothing to do. */
export function pickMove(view: PlayerView, legal: LegalActions): ClientAction | null {
  if (legal.rollForOrder) return { type: "rollForOrder" };
  const settle = legal.placeSettlement[0];
  if (settle !== undefined) return { type: "placeSettlement", vertex: settle };
  const road = legal.placeRoad[0];
  if (road !== undefined) return { type: "placeRoad", edge: road };
  if (legal.discard > 0) {
    const own = view.players[view.viewer ?? 0]?.resources;
    if (!own) return null;
    const cards: Partial<Record<Resource, number>> = {};
    let left = legal.discard;
    for (const r of Object.keys(own) as Resource[]) {
      const n = Math.min(own[r], left);
      if (n > 0) cards[r] = n;
      left -= n;
    }
    return { type: "discard", cards };
  }
  const robber = legal.moveRobber.find((o) => o.victims.length > 0) ?? legal.moveRobber[0];
  if (robber) return { type: "moveRobber", hex: robber.hex, victim: robber.victims[0] ?? null };
  if (legal.rollDice) return { type: "rollDice" };
  const free = legal.buildRoad[0];
  if (view.phase.kind === "roadBuilding" && free !== undefined) {
    return { type: "buildRoad", edge: free };
  }
  if (legal.endTurn) return { type: "endTurn" };
  return null;
}

/** The first seat (in seat order) with a move, and that move. */
export function nextMove(
  conns: readonly FakeConn[],
): { seat: number; action: ClientAction } | null {
  for (const [seat, c] of conns.entries()) {
    const g = c.game();
    if (!g) continue;
    const action = pickMove(g.view, g.legal);
    if (action) return { seat, action };
  }
  return null;
}

let seq = 0;
/** A request on `conn` with a fresh seq. */
export const req = (conn: Conn): { conn: Conn; seq: number } => ({ conn, seq: ++seq });

export interface Lobby {
  code: string;
  conns: FakeConn[];
  tokens: string[];
}

/** Creates a room with `names[0]` as host and joins the others in order. */
export async function makeLobby(svc: RoomService, names: readonly string[]): Promise<Lobby> {
  const conns = names.map(() => fakeConn());
  const tokens: string[] = [];
  const host = conns[0];
  if (!host) throw new Error("need at least one name");
  const created = await svc.createRoom(req(host), names[0] ?? "");
  if (!created.ok) throw new Error(`create failed: ${JSON.stringify(created)}`);
  const joined = host.of("roomJoined")[0]?.payload;
  if (!joined?.token) throw new Error("no roomJoined");
  tokens.push(joined.token);
  for (let i = 1; i < names.length; i++) {
    const c = conns[i] as FakeConn;
    const r = await svc.joinRoom(req(c), joined.room.toLowerCase(), names[i] ?? "");
    if (!r.ok) throw new Error(`join failed: ${JSON.stringify(r)}`);
    const t = c.of("roomJoined")[0]?.payload.token;
    if (!t) throw new Error("no token");
    tokens.push(t);
  }
  return { code: joined.room, conns, tokens };
}

/**
 * Plays autopilot moves until `stop` returns true (checked before each move) or `max`
 * moves were made. Returns the number of moves made.
 */
export async function drive(
  svc: RoomService,
  conns: readonly FakeConn[],
  stop: () => boolean,
  max: number,
): Promise<number> {
  let n = 0;
  while (n < max && !stop()) {
    const move = nextMove(conns);
    if (!move) throw new Error("no seat has a move");
    const r = await svc.gameAction(req(conns[move.seat] as FakeConn), move.action);
    if (!r.ok) throw new Error(`autopilot move refused: ${JSON.stringify(r)}`);
    n++;
  }
  return n;
}

/** A fake clock and scheduler for turn timer tests (see RoomServiceOptions.timers). */
export interface FakeClock {
  now: () => number;
  timers: TimerFns;
  /** Pending timers, soonest first (due = server ms). */
  pending(): number[];
  /**
   * Moves the clock forward by `ms`, firing every timer that falls due on the way (in due
   * order, with the clock set to its due time) and letting the room queues settle.
   */
  advance(ms: number): Promise<void>;
  /** Lets queued async work (store writes, room queues) finish. */
  flush(): Promise<void>;
}

export function fakeClock(start = 1_700_000_000_000): FakeClock {
  let t = start;
  let nextHandle = 0;
  const timers = new Map<number, { due: number; fn: () => void }>();
  const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise<void>((r) => setImmediate(r));
  };
  const clock: FakeClock = {
    now: () => t,
    timers: {
      setTimer(fn, ms) {
        const h = ++nextHandle;
        timers.set(h, { due: t + Math.max(0, ms), fn });
        return h;
      },
      clearTimer(handle) {
        timers.delete(handle as number);
      },
    },
    pending: () => [...timers.values()].map((x) => x.due).sort((a, b) => a - b),
    async advance(ms) {
      // No flush before the first timer: a test can queue an action that races it.
      const target = t + ms;
      for (;;) {
        let best: [number, { due: number; fn: () => void }] | null = null;
        for (const e of timers.entries()) {
          if (e[1].due <= target && (!best || e[1].due < best[1].due)) best = e;
        }
        if (!best) break;
        timers.delete(best[0]);
        t = Math.max(t, best[1].due);
        // Room timers return the fire's promise: await it (real store I/O may take a while).
        await (best[1].fn() as unknown);
        await flush();
      }
      t = target;
    },
    flush,
  };
  return clock;
}
