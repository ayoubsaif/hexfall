import { loadConfig } from "./config.ts";
import { createRedis } from "./redis.ts";
import { SERVER_VERSION, createServer } from "./server.ts";
import { createShutdown } from "./shutdown.ts";

const config = loadConfig();
const redis = createRedis(config.redisUrl);
const server = createServer(config, { redis });

const port = await server.listen(config.port);
console.log(
  `[server] hexfall ${SERVER_VERSION} (${config.nodeEnv}) listening on :${port}, ws at /ws, allowed origins: ${config.allowedOrigins.join(", ")}`,
);

const shutdown = createShutdown({ server, redis, exit: (code) => process.exit(code) });
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
