import { Redis } from "ioredis";

export type RedisStatus = "up" | "down";

/** The only surface the rest of the server sees. Swappable (and fakeable in tests). */
export interface RedisHandle {
  status(): RedisStatus;
  /** Resolves true on PONG, false on any failure. Never rejects. */
  ping(): Promise<boolean>;
  /** Closes the connection (gracefully if connected). Never rejects. */
  quit(): Promise<void>;
  /** The underlying client, for the Redis room store only (store/redis.ts). */
  readonly client: Redis;
}

export interface RedisOptions {
  /** Max delay between reconnect attempts. */
  maxBackoffMs?: number;
  log?: (msg: string) => void;
}

/** Exponential backoff: 200 ms, 400 ms, ... capped at `max`. */
export function reconnectDelay(attempt: number, max: number): number {
  return Math.min(200 * 2 ** Math.max(0, attempt - 1), max);
}

/**
 * Creates the single ioredis client. `rediss://` URLs enable TLS (ioredis parses
 * the scheme). An unreachable Redis never throws or crashes the process: errors
 * are logged once per outage, reconnects retry forever with a bounded backoff.
 */
export function createRedis(url: string, opts: RedisOptions = {}): RedisHandle {
  const maxBackoffMs = opts.maxBackoffMs ?? 10_000;
  const log = opts.log ?? ((msg: string) => console.log(`[redis] ${msg}`));
  const target = redactUrl(url);

  const client = new Redis(url, {
    lazyConnect: true,
    // Fail fast instead of queueing commands while disconnected.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    retryStrategy: (times) => reconnectDelay(times, maxBackoffMs),
  });

  let up = false;
  let erroredThisOutage = false;
  let attempts = 0;
  let closing = false;

  client.on("ready", () => {
    up = true;
    erroredThisOutage = false;
    if (attempts > 0) log(`reconnected to ${target} after ${attempts} attempt(s)`);
    else log(`connected to ${target}`);
    attempts = 0;
  });
  client.on("error", (err: Error) => {
    if (closing || erroredThisOutage) return;
    erroredThisOutage = true;
    log(`unreachable or failing (${target}): ${describeError(err)}`);
  });
  client.on("close", () => {
    if (up && !closing) log(`connection to ${target} lost`);
    up = false;
  });
  client.on("reconnecting", (delay: number) => {
    attempts++;
    // Log the first attempt, then every 10th, so a long outage is visible but quiet.
    if (attempts === 1 || attempts % 10 === 0) {
      log(`reconnecting (attempt ${attempts}, next in ${delay} ms)`);
    }
  });

  // Initial connect; failures are handled by the retry strategy above.
  client.connect().catch(() => {});

  return {
    client,
    status: () => (up && !closing && client.status === "ready" ? "up" : "down"),
    async ping() {
      try {
        return (await client.ping()) === "PONG";
      } catch {
        return false;
      }
    },
    async quit() {
      closing = true;
      try {
        if (client.status === "ready") await client.quit();
        else client.disconnect();
      } catch {
        client.disconnect();
      }
    },
  };
}

function describeError(err: Error): string {
  if (err.message) return err.message;
  // Node reports dual-stack connect failures as an AggregateError with an empty message.
  if (err instanceof AggregateError && err.errors.length > 0) {
    return err.errors.map((e: unknown) => (e instanceof Error ? e.message : String(e))).join("; ");
  }
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : err.name;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(invalid url)";
  }
}
