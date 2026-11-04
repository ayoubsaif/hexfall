import { afterEach, describe, expect, it } from "vite-plus/test";
import { WebSocket } from "ws";
import {
  CloseCode,
  PROTOCOL_VERSION,
  decodeServerMessage,
  encodeClient,
  type ServerMessage,
} from "@hexfall/protocol";
import { SERVER_VERSION, createServer, type HexfallServer } from "../src/server.ts";
import { createShutdown } from "../src/shutdown.ts";

const ORIGIN = "http://localhost:5173";
const fakeRedis = { status: () => "down" as const, quit: async () => {} };

let server: HexfallServer | undefined;
let base = "";

async function start(opts: { heartbeatMs?: number } = {}) {
  server = createServer({ allowedOrigins: [ORIGIN] }, { redis: fakeRedis, log: () => {}, ...opts });
  const port = await server.listen(0);
  base = `127.0.0.1:${port}`;
}

afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** Opens a socket and buffers decoded server messages. */
async function connect(origin = ORIGIN) {
  const ws = new WebSocket(`ws://${base}/ws`, { origin });
  const inbox: ServerMessage[] = [];
  const waiters: Array<() => void> = [];
  ws.on("message", (data) => {
    const d = decodeServerMessage((data as Buffer).toString("utf8"));
    if (!d.ok) throw new Error(`server sent invalid frame: ${d.detail}`);
    inbox.push(d.message);
    waiters.splice(0).forEach((w) => w());
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  const next = async (): Promise<ServerMessage> => {
    while (inbox.length === 0) await new Promise<void>((r) => waiters.push(r));
    return inbox.shift()!;
  };
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    ws.once("close", (code, reason) => resolve({ code, reason: reason.toString() })),
  );
  return { ws, next, closed };
}

describe("http", () => {
  it("GET /healthz reports ok, redis status and version", async () => {
    await start();
    const res = await fetch(`http://${base}/healthz`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ ok: true, redis: "down", version: SERVER_VERSION });
  });

  it("returns 404 for any other path", async () => {
    await start();
    expect((await fetch(`http://${base}/`)).status).toBe(404);
    expect((await fetch(`http://${base}/healthz/x`)).status).toBe(404);
    expect((await fetch(`http://${base}/ws`)).status).toBe(404);
  });
});

describe("websocket", () => {
  it("hello -> welcome and ping -> pong with re set and increasing seq", async () => {
    await start();
    const { ws, next } = await connect();
    ws.send(encodeClient("hello", { clientVersion: "test" }, 7));
    const welcome = await next();
    expect(welcome).toMatchObject({
      v: PROTOCOL_VERSION,
      type: "welcome",
      re: 7,
      payload: { serverVersion: SERVER_VERSION, protocolVersion: PROTOCOL_VERSION },
    });
    ws.send(encodeClient("ping", { t: 12345 }, 8));
    const pong = await next();
    expect(pong).toMatchObject({ type: "pong", re: 8, payload: { t: 12345 } });
    expect(pong.seq).toBe(welcome.seq + 1);
    ws.close();
  });

  it("rejects a disallowed Origin with 403", async () => {
    await start();
    const ws = new WebSocket(`ws://${base}/ws`, { origin: "http://evil.example" });
    const status = await new Promise<number | undefined>((resolve) => {
      ws.once("unexpected-response", (_req, res) => resolve(res.statusCode));
      ws.once("error", () => resolve(undefined));
    });
    expect(status).toBe(403);
  });

  it("rejects upgrades on other paths", async () => {
    await start();
    const ws = new WebSocket(`ws://${base}/other`, { origin: ORIGIN });
    const status = await new Promise<number | undefined>((resolve) => {
      ws.once("unexpected-response", (_req, res) => resolve(res.statusCode));
      ws.once("error", () => resolve(undefined));
    });
    expect(status).toBe(404);
  });

  it("answers a bad frame with an error and keeps the connection open", async () => {
    await start();
    const { ws, next } = await connect();
    ws.send("not json");
    expect(await next()).toMatchObject({ type: "error", payload: { code: "bad_frame" } });
    ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: "nope", seq: 1, payload: {} }));
    expect(await next()).toMatchObject({ type: "error", payload: { code: "bad_frame" } });
    ws.send(encodeClient("ping", { t: 1 }, 2));
    expect(await next()).toMatchObject({ type: "pong", re: 2 });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("answers a wrong protocol version with an error, then closes with 4000", async () => {
    await start();
    const { ws, next, closed } = await connect();
    ws.send(JSON.stringify({ v: PROTOCOL_VERSION + 1, type: "hello", seq: 0, payload: {} }));
    expect(await next()).toMatchObject({ type: "error", payload: { code: "version_mismatch" } });
    expect((await closed).code).toBe(CloseCode.VersionMismatch);
  });

  it("heartbeat terminates a socket that stops answering pings", async () => {
    await start({ heartbeatMs: 50 });
    const { ws, closed } = await connect();
    // Simulate a dead peer: stop the ws client from auto-replying to pings.
    (
      ws as unknown as { _receiver: { removeAllListeners(e: string): void } }
    )._receiver.removeAllListeners("ping");
    ws.pong = () => {};
    const { code } = await closed;
    expect(code).toBe(1006);
  });

  it("heartbeat keeps a responsive socket open", async () => {
    await start({ heartbeatMs: 30 });
    const { ws, next } = await connect();
    await new Promise((r) => setTimeout(r, 200));
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.send(encodeClient("ping", { t: 2 }, 0));
    expect(await next()).toMatchObject({ type: "pong" });
    ws.close();
  });
});

describe("graceful shutdown", () => {
  it("closes connected clients with 1012, quits redis, then exits 0", async () => {
    await start();
    const { closed } = await connect();
    const events: string[] = [];
    const shutdown = createShutdown({
      server: server!,
      redis: { quit: async () => void events.push("redis.quit") },
      exit: (code) => events.push(`exit:${code}`),
      log: () => {},
    });
    await shutdown("SIGTERM");
    expect(await closed).toEqual({ code: CloseCode.ServerRestarting, reason: "server restarting" });
    expect(events).toEqual(["redis.quit", "exit:0"]);
    // No longer accepting connections.
    await expect(fetch(`http://${base}/healthz`)).rejects.toThrow();
  });

  it("forces exit(1) when a step hangs past the hard timeout", async () => {
    const codes: number[] = [];
    const shutdown = createShutdown({
      server: { close: () => new Promise(() => {}) },
      redis: { quit: async () => {} },
      exit: (code) => codes.push(code),
      hardTimeoutMs: 50,
      log: () => {},
    });
    void shutdown("SIGINT");
    await new Promise((r) => setTimeout(r, 150));
    expect(codes).toEqual([1]);
  });
});
