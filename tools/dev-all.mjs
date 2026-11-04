// `pnpm run dev:all`: start local Redis, then the server and client.
// Ports default to 8080 (server) and 5173 (client); if one is taken (say, by another
// checkout's dev server), the next free port is used and both apps are told about it.
// On Windows, Docker runs inside WSL, which shuts its VM down when idle. A hidden
// `sleep infinity` keeps WSL (and Redis) alive after this command exits.
// Elsewhere, `docker compose up -d` runs directly. Redis keeps running after Ctrl+C;
// stop it with `docker compose down` (on Windows: `wsl --cd <repo> -e docker compose down`).
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

/** `G:\games\catan` -> `/mnt/g/games/catan` (WSL's view of a Windows path). */
function wslPath(p) {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
  if (!m) throw new Error(`cannot map ${p} to a WSL path`);
  return `/mnt/${m[1].toLowerCase()}/${m[2].replaceAll("\\", "/")}`;
}

function startRedis() {
  if (!isWindows) {
    const r = spawnSync("docker", ["compose", "up", "-d"], { cwd: root, stdio: "inherit" });
    if (r.status !== 0)
      console.warn("[dev:all] docker compose failed; the server will retry Redis.");
    return;
  }
  // Detached and hidden: survives this script and keeps the WSL VM awake.
  const keepAlive = spawn(
    "wsl",
    ["--cd", wslPath(root), "-e", "sh", "-c", "docker compose up -d && exec sleep infinity"],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  keepAlive.on("error", (err) => console.warn(`[dev:all] could not start WSL: ${err.message}`));
  keepAlive.unref();
  console.log("[dev:all] starting Redis in WSL (kept alive in the background)");
}

startRedis();

/** True when nothing listens on `port` on any loopback or wildcard address. */
function isFree(port) {
  const tryHost = (host) =>
    new Promise((done) => {
      const srv = createServer();
      srv.once("error", (err) => done(err.code === "EADDRNOTAVAIL")); // no IPv6: fine
      srv.listen({ port, host, exclusive: true }, () => srv.close(() => done(true)));
    });
  return ["127.0.0.1", "::1", "0.0.0.0", "::"].reduce(
    async (ok, host) => (await ok) && tryHost(host),
    Promise.resolve(true),
  );
}

async function freePort(wanted, taken = []) {
  for (let port = wanted; port < wanted + 50; port++) {
    if (!taken.includes(port) && (await isFree(port))) return port;
  }
  throw new Error(`no free port near ${wanted}`);
}

const serverPort = await freePort(Number(process.env.PORT) || 8080);
const clientPort = await freePort(Number(process.env.CLIENT_PORT) || 5173, [serverPort]);
const env = {
  ...process.env,
  // The environment wins over .env for both Node (--env-file) and Vite.
  PORT: String(serverPort),
  ALLOWED_ORIGIN: `http://localhost:${clientPort}`,
  VITE_SERVER_URL: `ws://localhost:${serverPort}`,
};
console.log(`[dev:all] server ws://localhost:${serverPort}  client http://localhost:${clientPort}`);

// The server reconnects to Redis on its own, so there is no need to wait for it here.
// One command string (not an args array): Windows needs a shell to find pnpm.cmd, and
// Node warns when args are passed alongside `shell`. Every argument here is ours.
const run = (cwd, command) =>
  spawn(`pnpm ${command}`, { cwd: join(root, cwd), env, stdio: "inherit", shell: true });
const children = [
  run("apps/server", "run dev"),
  run("apps/client", `exec vp dev --port ${clientPort} --strictPort`),
];
const stopAll = () => children.forEach((c) => c.exitCode === null && c.kill());
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
// If either app exits, stop the other so nothing is left half-running.
for (const child of children) {
  child.on("exit", (code) => {
    stopAll();
    process.exitCode ||= code ?? 1;
  });
}
