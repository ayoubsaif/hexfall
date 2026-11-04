// Game end through the service: the winning action is stored with a final snapshot,
// the room becomes "ended", and later actions get the engine's game_over.
import { createGame, publicVp, type GameState } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { hashToken } from "../src/rooms/codes.ts";
import { createRoomService } from "../src/rooms/service.ts";
import { fakeConn, req } from "../src/rooms/testing.ts";
import { createMemoryStore } from "../src/store/memory.ts";
import type { RoomMeta } from "../src/store/types.ts";

const CODE = "WVNNER"; // valid alphabet (no I, O, L, 0, 1)
const config = { seed: "end-test", mode: "beginner" as const, playerCount: 3 as const };

/** Seat 0 at 9 VP with a settlement on vertex 20 and the cards for a city. */
function nearWin(): GameState {
  const s = createGame(config);
  s.phase = { kind: "turn" };
  s.turn = { seat: 0, number: 5, rolled: true, devPlayed: false, dice: [3, 4] };
  s.longestRoad = 0;
  for (const v of [0, 10, 30]) s.vertices[v] = { owner: 0, kind: "city" };
  s.vertices[20] = { owner: 0, kind: "settlement" };
  const p = s.players[0]!;
  p.pieces.cities = 1;
  p.pieces.settlements = 4;
  p.resources.ore = 3;
  p.resources.grain = 2;
  s.bank.ore -= 3;
  s.bank.grain -= 2;
  return s;
}

describe("game end", () => {
  it("stores the final snapshot, marks the room ended, and rejects later actions", async () => {
    const store = createMemoryStore();
    const tokens = ["t0", "t1", "t2"];
    const meta: RoomMeta = {
      code: CODE,
      rev: 0,
      status: "playing",
      createdAt: 0,
      host: 0,
      seats: ["Ana", "Ben", "Cy"].map((name, i) => ({ name, tokenHash: hashToken(tokens[i]!) })),
      config,
    };
    expect(await store.createMeta(meta)).toEqual({ ok: true });
    const state = nearWin();
    expect(publicVp(state, 0)).toBe(9);
    // A stored history of one action, covered by a snapshot of the arranged state.
    expect(
      await store.appendAction(
        CODE,
        0,
        { action: { type: "rollForOrder", seat: 0 } },
        { version: 1, state },
      ),
    ).toEqual({ ok: true });

    const svc = createRoomService({ store, log: () => {} });
    const conns = tokens.map(() => fakeConn());
    for (const [i, c] of conns.entries()) {
      expect(await svc.resumeRoom(req(c), CODE, tokens[i]!)).toEqual({ ok: true });
    }

    const r = await svc.gameAction(req(conns[0]!), { type: "buildCity", vertex: 20 });
    expect(r).toEqual({ ok: true });

    const stored = await store.loadRoom(CODE);
    expect(stored?.version).toBe(2);
    expect(stored?.snapshot?.version).toBe(2);
    expect(stored?.snapshot?.state.winner).toBe(0);
    expect(stored?.actions).toEqual([]);
    expect(stored?.meta.status).toBe("ended");

    for (const c of conns) {
      const update = c.sent.findLast((m) => m.type === "gameUpdate");
      expect(update?.type === "gameUpdate" && update.payload.view.winner).toBe(0);
      const room = c.sent.findLast((m) => m.type === "roomState");
      expect(room?.type === "roomState" && room.payload.status).toBe("ended");
    }

    const after = await svc.gameAction(req(conns[1]!), { type: "endTurn" });
    expect(after).toMatchObject({ ok: false, rejected: { code: "game_over" } });
    svc.close();
  });
});
