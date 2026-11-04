// A small protocol client for integration tests: real ws socket, decoded inbox,
// and the latest game view/legal moves kept up to date from snapshots and updates.
import type { GameEvent, LegalActions, PlayerView } from "@hexfall/engine";
import {
  decodeServerMessage,
  encodeClient,
  type ClientMessage,
  type ServerMessage,
} from "@hexfall/protocol";
import { WebSocket } from "ws";

export const ORIGIN = "http://localhost:5173";

type ClientPayload<T extends ClientMessage["type"]> = Extract<
  ClientMessage,
  { type: T }
>["payload"];

export interface TestClient {
  ws: WebSocket;
  /** Every message received, in order. */
  all: ServerMessage[];
  send<T extends ClientMessage["type"]>(type: T, payload: ClientPayload<T>): number;
  /** Waits for the next message matching `pred` that arrived after `fromIndex`. */
  waitFor(pred: (m: ServerMessage) => boolean, fromIndex?: number): Promise<ServerMessage>;
  /** Latest full view (log accumulated from updates). */
  view: PlayerView | null;
  legal: LegalActions | null;
  version: number;
  /** Versions seen in order (snapshots and updates). */
  versions: number[];
  seat: number | null;
  token: string | null;
  room: string | null;
  closed: Promise<{ code: number; reason: string }>;
}

export async function connect(base: string): Promise<TestClient> {
  const ws = new WebSocket(`ws://${base}/ws`, { origin: ORIGIN });
  let seq = 0;
  const waiters: Array<() => void> = [];
  const c: TestClient = {
    ws,
    all: [],
    view: null,
    legal: null,
    version: -1,
    versions: [],
    seat: null,
    token: null,
    room: null,
    closed: new Promise((resolve) =>
      ws.once("close", (code, reason) => resolve({ code, reason: reason.toString() })),
    ),
    send(type, payload) {
      const s = seq++;
      ws.send(encodeClient(type, payload as never, s));
      return s;
    },
    async waitFor(pred, fromIndex = 0) {
      for (;;) {
        const found = c.all.slice(fromIndex).find(pred);
        if (found) return found;
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error("timed out waiting for a message")), 5000);
          waiters.push(() => {
            clearTimeout(t);
            resolve();
          });
        });
      }
    },
  };
  ws.on("message", (data) => {
    const d = decodeServerMessage((data as Buffer).toString("utf8"));
    if (!d.ok) throw new Error(`server sent an invalid frame: ${d.detail}`);
    const m = d.message;
    if (m.type === "roomJoined") {
      c.seat = m.payload.seat;
      c.room = m.payload.room;
      if (m.payload.token) c.token = m.payload.token;
    } else if (m.type === "gameSnapshot") {
      c.view = m.payload.view;
      c.legal = m.payload.legal;
      c.version = m.payload.version;
      c.versions.push(m.payload.version);
    } else if (m.type === "gameUpdate") {
      const log: GameEvent[] = [...(c.view?.log ?? []), ...m.payload.events];
      if (log.length !== m.payload.logLength) {
        throw new Error(`log length ${log.length} != ${m.payload.logLength}`);
      }
      c.view = { ...m.payload.view, log };
      c.legal = m.payload.legal;
      c.version = m.payload.version;
      c.versions.push(m.payload.version);
    }
    c.all.push(m);
    waiters.splice(0).forEach((w) => w());
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  return c;
}
