import { loadConfig } from "./config.ts";
import { createRedis } from "./redis.ts";
import { createRoomService } from "./rooms/service.ts";
import { SERVER_VERSION, createServer } from "./server.ts";
import { createShutdown } from "./shutdown.ts";
import { createRedisStore } from "./store/redis.ts";

const config = loadConfig();
const redis = createRedis(config.redisUrl);
const store = createRedisStore(redis.client);
const log = (msg: string) => console.log(`[server] ${msg}`);
const service = createRoomService({ store, log });
const server = createServer(config, { redis, service, log });

const port = await server.listen(config.port);
console.log(
  `[server] hexfall ${SERVER_VERSION} (${config.nodeEnv}) listening on :${port}, ws at /ws, allowed origins: ${config.allowedOrigins.join(", ")}`,
);

const shutdown = createShutdown({ server, redis, exit: (code) => process.exit(code) });
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
