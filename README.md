# Hexfall

An online board game for 3–4 players in the browser, following the base rules of Catan (5th edition). The art and theme are Hexfall's own. AGENTS.md has the full rules the engine implements.

| Part     | Path                | What it is                                                                 |
| -------- | ------------------- | -------------------------------------------------------------------------- |
| Engine   | `packages/engine`   | Pure, deterministic rules engine (seeded RNG). No I/O.                     |
| Protocol | `packages/protocol` | Shared message types and schemas between client and server.                |
| Server   | `apps/server`       | Node WebSocket server: rooms, seats, validated actions, Redis persistence. |
| Client   | `apps/client`       | React + three.js web app (static files). English and Spanish.              |

## Requirements

- Node.js 24 or newer
- pnpm 12.16.1. Any pnpm downloads the right version itself (the `devEngines` field).
- Redis 7. The included `docker-compose.yml` runs one locally.

## Run locally

```sh
pnpm install
docker compose up -d       # Redis on localhost:6379
cp .env.example .env       # defaults work for local play
pnpm run dev               # server on :8080, client on http://localhost:5173
```

Open http://localhost:5173 in three browser windows (one per player) to play a game. Use separate browser profiles, because seats are remembered in `localStorage`, which is shared between tabs.

Other commands:

```sh
pnpm run test    # all unit tests
pnpm run check   # format, lint, type-check, engine purity and asset checks
pnpm run build   # production builds of every package
```

## Deploy

A deployment has three parts:

1. **Redis**: the source of truth for every room. A room expires after 14 days without changes.
2. **Game server**: one Node process that serves WebSockets at `/ws` and a health check at `/healthz`.
3. **Client**: static files that any static host can serve.

> **Run exactly one server instance.** Rooms are cached in memory. Two instances would not see each other's players. Redis detects the conflict and refuses the action, but players on different instances would still be out of sync.

### Configuration

| Variable           | Used by      | Example                                | Notes                                                                                                                             |
| ------------------ | ------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS_URL`        | server       | `rediss://default:…@….upstash.io:6379` | `redis://` or `rediss://` (TLS). Keep it secret.                                                                                  |
| `ALLOWED_ORIGIN`   | server       | `https://hexfall.example.com`          | The client's origin. Use commas for several. Upgrades from any other origin are refused with 403.                                 |
| `PORT`             | server       | `8080`                                 | Port the server listens on.                                                                                                       |
| `NODE_ENV`         | server       | `production`                           |                                                                                                                                   |
| `VITE_SERVER_URL`  | client build | `wss://hexfall-server.example.com`     | The server's base URL, **without** `/ws`. Baked into the bundle at build time. Use `wss://` when the client is served over HTTPS. |
| `VITE_THEME`       | client build | `diorama`                              | Optional.                                                                                                                         |
| `VITE_APP_VERSION` | client build | `1.0.0`                                | Optional. Sent to the server in `hello`.                                                                                          |

Client variables are public. They end up in the JavaScript bundle, so never put secrets in them. The server reads its variables once at startup. If a value is invalid, the server prints the problem and exits.

### 1. Redis

Use any Redis 7 instance the server can reach, for example Upstash (use its `rediss://` URL) or a managed Redis. Turn persistence on (AOF or snapshots) if you host Redis yourself.

### 2. Game server

The server listens on plain HTTP. Put it behind something that terminates TLS (most hosts, including Fly.io, do this), so the client can connect over `wss://`.

**Option A: Docker** (any container host). The `Dockerfile` at the repo root builds the server image.

```sh
docker build -t hexfall-server .
docker run -d --restart unless-stopped -p 8080:8080 \
  -e REDIS_URL='rediss://…' \
  -e ALLOWED_ORIGIN='https://hexfall.example.com' \
  hexfall-server
```

For example, on Fly.io:

```sh
fly launch --no-deploy            # detects the Dockerfile; internal port 8080
fly secrets set REDIS_URL='rediss://…' ALLOWED_ORIGIN='https://hexfall.example.com'
fly deploy
fly scale count 1                 # one instance (see the note above)
```

**Option B: Node host without Docker.**

```sh
pnpm install --frozen-lockfile
pnpm --filter @hexfall/server build
pnpm --filter @hexfall/server deploy --prod ./server-out
cd server-out
REDIS_URL='rediss://…' ALLOWED_ORIGIN='https://hexfall.example.com' NODE_ENV=production node dist/main.mjs
```

`server-out` contains only `dist/main.mjs` and the server's production dependencies (`ws`, `ioredis`, `zod`). Run it under a process manager (systemd, pm2…). The server shuts down cleanly on `SIGTERM`.

**Check it:**

```sh
curl https://hexfall-server.example.com/healthz
# {"ok":true,"redis":"up","version":"0.0.0","rooms":0}
```

### 3. Client

```sh
pnpm install --frozen-lockfile
VITE_SERVER_URL='wss://hexfall-server.example.com' pnpm --filter @hexfall/client build
```

Upload `apps/client/dist` to any static host: Vercel, Netlify, Cloudflare Pages, S3 + CDN, nginx… The app is a single page and invite links use a query string (`/?room=CODE`), so no rewrite rules are needed. It must be served from the site root (`/`).

On Vercel, for example: set the root directory to `apps/client`, the build command to `pnpm run build`, the output directory to `dist`, and add `VITE_SERVER_URL` as an environment variable.

### 4. Final checks

- `ALLOWED_ORIGIN` on the server is exactly the client's origin: scheme + host (+ port), no trailing slash.
- Open the client. The corner shows "Connected". Create a room in one browser and join from two others.
- Restart the server during a game. The players reconnect and the game continues from Redis.

### Updating

Deploy the server and the client together whenever `PROTOCOL_VERSION` in `packages/protocol/src/envelope.ts` changes. An old client talking to a new server gets a "new version" banner asking the player to reload. Games in progress survive server restarts.

## Assets

`assets/` holds third-party reference images. It is git-ignored and is never built, committed or deployed. The shipped art lives in `apps/client/public/themes/`.
