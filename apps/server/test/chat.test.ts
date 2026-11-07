// In-game chat in the room layer: delivery to every seat, cleaning, history on rejoin, and the
// 50-message memory cap. Chat is never written to the store.
import { CHAT_HISTORY, CHAT_MAX_LENGTH } from "@hexfall/protocol";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createRoomService, type RoomService } from "../src/rooms/service.ts";
import { fakeClock, fakeConn, makeLobby, req } from "../src/rooms/testing.ts";
import { createMemoryStore } from "../src/store/memory.ts";

const services: RoomService[] = [];
afterEach(() => {
  for (const s of services.splice(0)) s.close();
});

function setup() {
  const clock = fakeClock();
  const svc = createRoomService({
    store: createMemoryStore({ now: clock.now }),
    now: clock.now,
    timers: clock.timers,
    log: () => {},
  });
  services.push(svc);
  return { svc };
}

describe("chat", () => {
  it("sends a cleaned line to every connected seat with the sender's name", async () => {
    const { svc } = setup();
    const lobby = await makeLobby(svc, ["Ana", "Bo"]);
    const [ana, bo] = lobby.conns;
    expect(await svc.chat(req(ana!), "  hello\n\n  there \u0007 ")).toEqual({ ok: true });
    for (const c of [ana!, bo!]) {
      const lines = c.of("chatLine");
      expect(lines).toHaveLength(1);
      expect(lines[0]!.payload.entry).toMatchObject({ seat: 0, name: "Ana", text: "hello there" });
    }
  });

  it("ignores empty lines, caps length, and rejects an unseated connection", async () => {
    const { svc } = setup();
    const lobby = await makeLobby(svc, ["Ana", "Bo"]);
    const [ana] = lobby.conns;
    await svc.chat(req(ana!), "   \n ");
    expect(ana!.of("chatLine")).toHaveLength(0);
    await svc.chat(req(ana!), "x".repeat(CHAT_MAX_LENGTH + 50));
    expect(ana!.of("chatLine")[0]!.payload.entry.text).toHaveLength(CHAT_MAX_LENGTH);
    const r = await svc.chat(req(fakeConn()), "hi");
    expect(r).toMatchObject({ ok: false, error: { code: "no_seat" } });
  });

  it("keeps only the last messages and replays them to a seat that resumes", async () => {
    const { svc } = setup();
    const lobby = await makeLobby(svc, ["Ana", "Bo"]);
    const [ana, bo] = lobby.conns;
    for (let i = 0; i < CHAT_HISTORY + 5; i++) await svc.chat(req(ana!), `m${i}`);
    const back = fakeConn();
    const r = await svc.resumeRoom(req(back), lobby.code, lobby.tokens[1]!);
    expect(r).toEqual({ ok: true });
    const history = back.of("chatHistory")[0]!.payload.entries;
    expect(history).toHaveLength(CHAT_HISTORY);
    expect(history[0]!.text).toBe("m5");
    expect(history.at(-1)!.text).toBe(`m${CHAT_HISTORY + 4}`);
    expect(bo).toBeDefined();
  });
});
