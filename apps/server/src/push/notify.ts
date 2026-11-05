// Who gets a turn push after a game change (specs/game-server "Turn push delivery"): each
// seat the game newly waits for that has no visible connection. Sends run in the background
// and never touch the game; a subscription the push service reports gone is deleted.
import { legalActions, type GameState, type Seat } from "@hexfall/engine";
import { waitKindOf, type PushPayload } from "@hexfall/protocol";
import { waitingSeats } from "../rooms/timer.ts";
import type { PushSender } from "./sender.ts";
import type { PushStore } from "./store.ts";

/** TTL when no deadline runs (timer off). */
export const DEFAULT_PUSH_TTL_S = 3600;

export interface WaitChange {
  room: string;
  /** null at game start. */
  before: GameState | null;
  after: GameState;
  /** Token hash per seat (the push store key). */
  holders: readonly string[];
  /** Whether the seat has a connected, visible page. */
  visible: (seat: Seat) => boolean;
  /** Server-clock deadline of the new wait, or null. */
  deadline: number | null;
  now: number;
}

export interface TurnNotifier {
  /** Starts the sends for one change; returns at once. */
  waitsChanged(change: WaitChange): void;
  /** Resolves when every send started so far has finished (tests, shutdown). */
  idle(): Promise<void>;
}

/** Seats waited for after but not before (all waited seats at game start). */
export function newlyWaited(before: GameState | null, after: GameState): Seat[] {
  if (after.phase.kind === "ended") return [];
  const was = new Set(before ? waitingSeats(before) : []);
  return waitingSeats(after).filter((s) => !was.has(s));
}

export function ttlSeconds(deadline: number | null, now: number): number {
  if (deadline === null) return DEFAULT_PUSH_TTL_S;
  return Math.min(DEFAULT_PUSH_TTL_S, Math.max(30, Math.ceil((deadline - now) / 1000)));
}

export function createTurnNotifier(opts: {
  store: PushStore;
  sender: PushSender;
  log?: (msg: string) => void;
}): TurnNotifier {
  const { store, sender } = opts;
  const log = opts.log ?? (() => {});
  const inflight = new Set<Promise<void>>();

  async function deliver(room: string, holder: string, kind: PushPayload["kind"], ttl: number) {
    const subs = await store.list(room, holder);
    await Promise.all(
      subs.map(async (sub) => {
        const payload: PushPayload = { v: 1, kind, room, lang: sub.lang };
        const outcome = await sender.send({ sub, payload, ttlSeconds: ttl, topic: room });
        if (outcome === "gone") await store.remove(room, holder, sub.endpoint);
      }),
    );
  }

  return {
    waitsChanged(c) {
      const ended = c.after.phase.kind === "ended";
      for (const seat of newlyWaited(c.before, c.after)) {
        if (c.visible(seat)) continue;
        const holder = c.holders[seat];
        const kind = waitKindOf(legalActions(c.after, seat), ended);
        if (!holder || !kind) continue;
        const p = deliver(c.room, holder, kind, ttlSeconds(c.deadline, c.now))
          .catch((e: unknown) => log(`room ${c.room}: push for seat ${seat} failed: ${String(e)}`))
          .finally(() => inflight.delete(p));
        inflight.add(p);
      }
    },
    async idle() {
      while (inflight.size > 0) await Promise.all(inflight);
    },
  };
}
