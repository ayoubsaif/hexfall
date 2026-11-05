import http from "node:http";
import type { Duplex } from "node:stream";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { CloseCode } from "@hexfall/protocol";
import type { Config } from "./config.ts";
import type { RedisHandle } from "./redis.ts";
import { createRoomService, type RoomService } from "./rooms/service.ts";
import { createSession } from "./session.ts";
import { createMemoryStore } from "./store/memory.ts";
import pkg from "../package.json" with { type: "json" };

export const SERVER_VERSION: string = pkg.version;

export interface ServerDeps {
  redis: Pick<RedisHandle, "status">;
  /** ws-level ping interval; sockets that miss one pong are terminated. Default 30 s. */
  heartbeatMs?: number;
  /** How long close() waits for clients to finish the close handshake. Default 3 s. */
  closeGraceMs?: number;
  log?: (msg: string) => void;
  /** Room layer. Default: a RoomService over an in-memory store. */
  service?: RoomService;
  /** Clock for per-connection rate limiting. Default Date.now. */
  now?: () => number;
}

export interface HexfallServer {
  /** Starts listening; resolves with the actual port (use 0 for an ephemeral one). */
  listen(port: number): Promise<number>;
  /** Stops accepting, closes every socket with 1012 "server restarting", closes the HTTP server. */
  close(): Promise<void>;
}

export function createServer(
  config: Pick<Config, "allowedOrigins"> & Partial<Pick<Config, "push">>,
  deps: ServerDeps,
): HexfallServer {
  const heartbeatMs = deps.heartbeatMs ?? 30_000;
  const closeGraceMs = deps.closeGraceMs ?? 3_000;
  const log = deps.log ?? ((msg: string) => console.log(`[server] ${msg}`));
  const allowed = new Set(config.allowedOrigins);
  const service = deps.service ?? createRoomService({ store: createMemoryStore(), log });
  let closing = false;

  const httpServer = http.createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (req.method === "GET" && path === "/healthz") {
      sendJson(res, 200, {
        ok: true,
        redis: deps.redis.status(),
        version: SERVER_VERSION,
        rooms: service.loadedRooms(),
      });
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found" });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const alive = new WeakMap<WebSocket, boolean>();

  httpServer.on("upgrade", (req, socket, head) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path !== "/ws") return rejectUpgrade(socket, 404, "Not Found");
    if (closing) return rejectUpgrade(socket, 503, "Service Unavailable");
    const origin = req.headers.origin;
    if (origin === undefined || !allowed.has(origin)) {
      log(`rejected upgrade from origin ${origin ?? "(none)"}`);
      return rejectUpgrade(socket, 403, "Forbidden");
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws));
  });

  function onConnection(ws: WebSocket): void {
    const session = createSession({
      service,
      id: randomUUID(),
      serverVersion: SERVER_VERSION,
      pushKey: config.push?.publicKey ?? null,
      log,
      ...(deps.now ? { now: deps.now } : {}),
      send: (raw) => {
        if (ws.readyState === ws.OPEN) ws.send(raw);
      },
      close: (code, reason) => ws.close(code, reason),
    });

    alive.set(ws, true);
    ws.on("pong", () => alive.set(ws, true));
    ws.on("error", (err) => log(`socket error: ${err.message}`));
    ws.on("close", () => session.closed());

    ws.on("message", (data, isBinary) => {
      if (isBinary) session.handleBinary();
      else void session.handle(rawToString(data));
    });
  }

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();

  return {
    listen(port) {
      return new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, () => {
          httpServer.off("error", reject);
          const addr = httpServer.address();
          resolve(typeof addr === "object" && addr !== null ? addr.port : port);
        });
      });
    },
    async close() {
      if (closing) return;
      closing = true;
      clearInterval(heartbeat);
      const httpClosed = new Promise<void>((resolve) => httpServer.close(() => resolve()));
      const sockets = [...wss.clients];
      await Promise.all(
        sockets.map(
          (ws) =>
            new Promise<void>((resolve) => {
              if (ws.readyState === ws.CLOSED) return resolve();
              const timer = setTimeout(() => {
                ws.terminate();
                resolve();
              }, closeGraceMs);
              ws.once("close", () => {
                clearTimeout(timer);
                resolve();
              });
              ws.close(CloseCode.ServerRestarting, "server restarting");
            }),
        ),
      );
      wss.close();
      service.close();
      httpServer.closeAllConnections();
      await httpClosed;
    },
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  res.end(json);
}

function rejectUpgrade(socket: Duplex, status: number, text: string): void {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function rawToString(data: WebSocket.RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return data.toString("utf8");
}
