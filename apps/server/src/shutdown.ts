import type { RedisHandle } from "./redis.ts";
import type { HexfallServer } from "./server.ts";

export interface ShutdownDeps {
  server: Pick<HexfallServer, "close">;
  redis: Pick<RedisHandle, "quit">;
  exit: (code: number) => void;
  /** Forces exit(1) if graceful shutdown takes longer than this. Default 10 s. */
  hardTimeoutMs?: number;
  log?: (msg: string) => void;
}

/**
 * Returns an idempotent shutdown routine: stop accepting connections, close every
 * socket with 1012 "server restarting", quit Redis, then exit(0). A hard timeout
 * forces exit(1) if any step hangs.
 */
export function createShutdown(deps: ShutdownDeps): (reason: string) => Promise<void> {
  const log = deps.log ?? ((msg: string) => console.log(`[shutdown] ${msg}`));
  const hardTimeoutMs = deps.hardTimeoutMs ?? 10_000;
  let running: Promise<void> | undefined;

  return (reason) => {
    running ??= (async () => {
      log(`${reason} received, shutting down`);
      const hard = setTimeout(() => {
        log(`graceful shutdown exceeded ${hardTimeoutMs} ms, forcing exit`);
        deps.exit(1);
      }, hardTimeoutMs);
      hard.unref();
      let code = 0;
      try {
        await deps.server.close();
        await deps.redis.quit();
      } catch (err) {
        log(`error during shutdown: ${err instanceof Error ? err.message : String(err)}`);
        code = 1;
      }
      clearTimeout(hard);
      log("bye");
      deps.exit(code);
    })();
    return running;
  };
}
