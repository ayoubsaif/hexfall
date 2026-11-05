import { loadConfig } from "./config.ts";
import { createTurnNotifier } from "./push/notify.ts";
import { createWebPushSender } from "./push/sender.ts";
import { createRedisPushStore } from "./push/store.ts";
import { createRedis } from "./redis.ts";
import { createRoomService } from "./rooms/service.ts";
import { SERVER_VERSION, createServer } from "./server.ts";
import { createShutdown } from "./shutdown.ts";
import { createRedisStore } from "./store/redis.ts";

const config = loadConfig();
const redis = createRedis(config.redisUrl);
const store = createRedisStore(redis.client);
const log = (msg: string) => console.log(`[server] ${msg}`);
const pushStore = config.push ? createRedisPushStore(redis.client) : null;
const push =
  config.push && pushStore
    ? {
        store: pushStore,
        notifier: createTurnNotifier({
          store: pushStore,
          sender: createWebPushSender(config.push, log),
          log,
        }),
      }
    : undefined;
const service = createRoomService({ store, log, ...(push ? { push } : {}) });
const server = createServer(config, { redis, service, log });

const port = await server.listen(config.port);
console.log(
  `[server] hexfall ${SERVER_VERSION} (${config.nodeEnv}) listening on :${port}, ws at /ws, allowed origins: ${config.allowedOrigins.join(", ")}, web push: ${push ? "on" : "off"}`,
);

const shutdown = createShutdown({ server, redis, exit: (code) => process.exit(code) });
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
