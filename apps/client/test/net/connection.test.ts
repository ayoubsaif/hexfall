import { CloseCode, PROTOCOL_VERSION } from "@hexfall/protocol";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { storeListener } from "../../src/net/bindStore.ts";
import { backoffDelay, Connection, wsUrl } from "../../src/net/connection.ts";
import { initialConnectionState, useConnectionStore } from "../../src/store/connection.ts";
import { FakeClock, FakeSocket } from "./fakes.ts";

const welcome = (seq = 0) => ({
  v: PROTOCOL_VERSION,
  type: "welcome",
  seq,
  payload: { serverVersion: "9.9.9", protocolVersion: PROTOCOL_VERSION },
});

let clock: FakeClock;
let logs: string[];

function make(random = () => 0.5) {
  const conn = new Connection({
    serverUrl: "ws://test:1234/",
    clientVersion: "1.2.3",
    WebSocket: FakeSocket,
    timers: clock,
    now: clock.now,
    random,
    log: (m) => logs.push(m),
    listener: storeListener(),
  });
  conn.start();
  return conn;
}

beforeEach(() => {
  FakeSocket.instances = [];
  clock = new FakeClock();
  logs = [];
  useConnectionStore.setState({ ...initialConnectionState });
});

describe("Connection", () => {
  it("connects to <base>/ws and sends hello on open", () => {
    make();
    const s = FakeSocket.last();
    expect(s.url).toBe("ws://test:1234/ws");
    expect(wsUrl("ws://localhost:8080")).toBe("ws://localhost:8080/ws");
    expect(useConnectionStore.getState().status).toBe("connecting");
    s.serverOpen();
    expect(s.sentMessages()[0]).toMatchObject({
      v: PROTOCOL_VERSION,
      type: "hello",
      seq: 0,
      payload: { clientVersion: "1.2.3" },
    });
  });

  it("welcome updates the store and starts pinging with increasing seq", () => {
    const conn = make();
    const s = FakeSocket.last();
    s.serverOpen();
    s.serverSend(welcome(7));
    expect(useConnectionStore.getState()).toMatchObject({
      status: "open",
      serverVersion: "9.9.9",
      protocolVersion: PROTOCOL_VERSION,
      attempts: 0,
    });
    expect(conn.lastServerSeq).toBe(7);
    clock.advance(5000);
    const msgs = s.sentMessages();
    expect(msgs.map((m) => m.type)).toEqual(["hello", "ping", "ping"]);
    expect(msgs.map((m) => m.seq)).toEqual([0, 1, 2]);
  });

  it("pong gives a latency of now - t", () => {
    make();
    const s = FakeSocket.last();
    s.serverOpen();
    s.serverSend(welcome());
    const ping = s.sentMessages().find((m) => m.type === "ping");
    expect(ping).toBeDefined();
    clock.advance(42);
    s.serverSend({ v: PROTOCOL_VERSION, type: "pong", seq: 1, re: 1, payload: ping?.payload });
    expect(useConnectionStore.getState().latencyMs).toBe(42);
  });

  it("logs and ignores invalid frames", () => {
    make();
    const s = FakeSocket.last();
    s.serverOpen();
    s.serverSend("not json");
    s.serverSend({ v: PROTOCOL_VERSION, type: "welcome", seq: 0, payload: {} });
    s.serverSend({ v: PROTOCOL_VERSION, type: "bogus", seq: 0, payload: {} });
    expect(logs).toHaveLength(3);
    expect(useConnectionStore.getState().status).toBe("connecting");
    // still usable afterwards
    s.serverSend(welcome());
    expect(useConnectionStore.getState().status).toBe("open");
  });

  it("backoff grows exponentially with jitter and caps at 10 s", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => backoffDelay(n, () => 1))).toEqual([
      500, 1000, 2000, 4000, 8000, 10000, 10000, 10000,
    ]);
    expect(backoffDelay(3, () => 0)).toBe(1000);
    expect(backoffDelay(10, () => 0)).toBe(5000);
  });

  it("reconnects with backoff after drops and resets the schedule on welcome", () => {
    make(() => 1);
    for (let i = 0; i < 4; i++) {
      FakeSocket.last().serverClose(1006);
      expect(useConnectionStore.getState()).toMatchObject({
        status: "reconnecting",
        attempts: i + 1,
      });
      clock.advance(clock.delays.at(-1) ?? 0);
    }
    expect(clock.delays).toEqual([500, 1000, 2000, 4000]);
    expect(FakeSocket.instances).toHaveLength(5);
    const s = FakeSocket.last();
    s.serverOpen();
    s.serverSend(welcome());
    expect(useConnectionStore.getState().attempts).toBe(0);
    s.serverClose(1006);
    expect(clock.delays.at(-1)).toBe(500);
  });

  it("reconnects after close 1012 (server restarting)", () => {
    make();
    const first = FakeSocket.last();
    first.serverOpen();
    first.serverSend(welcome());
    first.serverClose(CloseCode.ServerRestarting);
    expect(useConnectionStore.getState().status).toBe("reconnecting");
    expect(FakeSocket.instances).toHaveLength(1);
    clock.advance(10_000);
    expect(FakeSocket.instances).toHaveLength(2);
    const second = FakeSocket.last();
    second.serverOpen();
    expect(second.sentMessages()[0]?.type).toBe("hello");
    second.serverSend(welcome());
    expect(useConnectionStore.getState().status).toBe("open");
  });

  it("does not reconnect after close 4000 and reports version_mismatch", () => {
    make();
    const s = FakeSocket.last();
    s.serverOpen();
    s.serverClose(CloseCode.VersionMismatch);
    expect(useConnectionStore.getState().status).toBe("version_mismatch");
    clock.advance(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(clock.pending()).toBe(0);
  });

  it("does not reconnect after a version_mismatch error frame", () => {
    make();
    const s = FakeSocket.last();
    s.serverOpen();
    s.serverSend({
      v: PROTOCOL_VERSION,
      type: "error",
      seq: 0,
      payload: { code: "version_mismatch", message: "reload" },
    });
    expect(useConnectionStore.getState().status).toBe("version_mismatch");
    s.serverClose(1006);
    clock.advance(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(useConnectionStore.getState().status).toBe("version_mismatch");
  });

  it("treats a frame with a different protocol v as a version mismatch", () => {
    make();
    const s = FakeSocket.last();
    s.serverOpen();
    s.serverSend({ ...welcome(), v: PROTOCOL_VERSION + 1 });
    expect(useConnectionStore.getState().status).toBe("version_mismatch");
  });

  it("close() stops for good", () => {
    const conn = make();
    const s = FakeSocket.last();
    s.serverOpen();
    conn.close();
    expect(s.closedWith).toBe(1000);
    expect(useConnectionStore.getState().status).toBe("closed");
    clock.advance(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("does not reconnect after close 4001 (replaced) and reports replaced", () => {
    make();
    const s = FakeSocket.last();
    s.serverOpen();
    s.serverSend(welcome());
    s.serverClose(CloseCode.Replaced);
    expect(useConnectionStore.getState().status).toBe("replaced");
    clock.advance(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(clock.pending()).toBe(0);
  });

  it("restart() reopens at once without backoff, also after a replaced close", () => {
    const conn = make();
    const first = FakeSocket.last();
    first.serverOpen();
    first.serverSend(welcome());
    first.serverClose(CloseCode.Replaced);
    conn.restart();
    expect(FakeSocket.instances).toHaveLength(2);
    expect(useConnectionStore.getState().status).toBe("connecting");
    const second = FakeSocket.last();
    second.serverOpen();
    second.serverSend(welcome());
    expect(useConnectionStore.getState().status).toBe("open");

    // From an open socket: the old one is closed and ignored afterwards.
    conn.restart();
    expect(second.closedWith).toBe(1000);
    expect(FakeSocket.instances).toHaveLength(3);
    second.serverClose(1006);
    expect(useConnectionStore.getState().status).toBe("connecting");
    expect(clock.delays).toEqual([]);
  });

  it("restart() does nothing after a version mismatch", () => {
    const conn = make();
    FakeSocket.last().serverClose(CloseCode.VersionMismatch);
    conn.restart();
    expect(FakeSocket.instances).toHaveLength(1);
    expect(useConnectionStore.getState().status).toBe("version_mismatch");
  });
});
