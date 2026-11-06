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

## Saving and ending games

- **Close game for now**: during a game the host has a "Game" button next to settings. Closing the game pauses it for everyone: no moves, and the turn timer stops with its time left. Players can close their tabs. The paused game stays in Redis for 7 days after the pause, then it is deleted. Only the host can resume it, and the timer continues where it stopped.
- **Your games**: the start screen lists every room this browser holds a seat in (paused, running or in the lobby), with when each game started and its last move, and "Continue" and "Remove". The host also gets "End game" there for old games. Rooms that expired or ended drop off the list.
- **End game now**: the host can end a running or paused game early. The player with the most victory points (hidden VP cards included) wins; tied players share the win. Everyone sees the final scores. The result is kept for 1 day.
- Other rooms expire 14 days after their last change.

## Dice

The dice are 3D and are thrown onto a mat beside the island with real physics ([cannon-es](https://github.com/pmndrs/cannon-es), loaded only once a game is shown). The server still rolls every number with its seeded RNG. Each client simulates the throw first, sees which side lands up, and turns the die model inside its physics body so that side shows the rolled value. The die never jumps at the end. Every player sees the same tumble, because it is seeded from the room code and the roll. After a reload or under reduced motion, the dice show their values at rest without a throw.

## Deploy

A deployment has three parts:

1. **Redis**: the source of truth for every room. A room expires after 14 days without changes.
2. **Game server**: one Node process that serves WebSockets at `/ws` and a health check at `/healthz`.
3. **Client**: static files that any static host can serve.

> **Run exactly one server instance.** Rooms are cached in memory. Two instances would not see each other's players. Redis detects the conflict and refuses the action, but players on different instances would still be out of sync.

### Configuration

| Variable            | Used by      | Example                                | Notes                                                                                                                             |
| ------------------- | ------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS_URL`         | server       | `rediss://default:…@….upstash.io:6379` | `redis://` or `rediss://` (TLS). Keep it secret.                                                                                  |
| `ALLOWED_ORIGIN`    | server       | `https://hexfall.example.com`          | The client's origin. Use commas for several. Upgrades from any other origin are refused with 403.                                 |
| `PORT`              | server       | `8080`                                 | Port the server listens on.                                                                                                       |
| `NODE_ENV`          | server       | `production`                           |                                                                                                                                   |
| `VITE_SERVER_URL`   | client build | `wss://hexfall-server.example.com`     | The server's base URL, **without** `/ws`. Baked into the bundle at build time. Use `wss://` when the client is served over HTTPS. |
| `VITE_THEME`        | client build | `diorama`                              | Optional.                                                                                                                         |
| `VITE_APP_VERSION`  | client build | `1.0.0`                                | Optional. Sent to the server in `hello`.                                                                                          |
| `VITE_SITE_URL`     | client build | `https://hexfall.example.com`          | Optional. The client's public URL. Makes `og:image`, `og:url` and the canonical link absolute so shared links show a preview.     |
| `VAPID_PUBLIC_KEY`  | server       | `BEl62iUY…`                            | Optional. Web Push key pair for turn notifications. Set all three VAPID variables or none; without them push is off.              |
| `VAPID_PRIVATE_KEY` | server       | `Dt1CLgQl…`                            | Keep it secret.                                                                                                                   |
| `VAPID_SUBJECT`     | server       | `mailto:ops@hexfall.example.com`       | A `mailto:` or `https:` contact for push services.                                                                                |

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

**Turn notifications (optional).** Generate a VAPID key pair once and keep it: changing it invalidates every stored subscription.

```sh
npx web-push generate-vapid-keys
fly secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:ops@hexfall.example.com
```

The server then sends a push when the game starts waiting on a player whose tab is hidden or closed. Players turn notifications on with the bell next to the language switch. On iPhone and iPad, push only works after adding the game to the home screen.

### 3. Client

```sh
pnpm install --frozen-lockfile
VITE_SERVER_URL='wss://hexfall-server.example.com' VITE_SITE_URL='https://hexfall.example.com' \
  pnpm --filter @hexfall/client build
```

Upload `apps/client/dist` to any static host: Vercel, Netlify, Cloudflare Pages, S3 + CDN, nginx… The app is a single page and invite links use a query string (`/?room=CODE`), so no rewrite rules are needed. It must be served from the site root (`/`).

On Vercel, for example: set the root directory to `apps/client`, the build command to `pnpm run build`, the output directory to `dist`, and add `VITE_SERVER_URL` as an environment variable.

### 4. Final checks

- `ALLOWED_ORIGIN` on the server is exactly the client's origin: scheme + host (+ port), no trailing slash.
- Open the client. The corner shows "Connected". Create a room in one browser and join from two others.
- Restart the server during a game. The players reconnect and the game continues from Redis.

### Updating

Deploy the server and the client together whenever `PROTOCOL_VERSION` in `packages/protocol/src/envelope.ts` changes (version 5 added pausing, ending early and the saved games list). An old client talking to a new server gets a "new version" banner asking the player to reload. Games in progress survive server restarts.

## Assets

Piece and die models are converted from committed sources in `docs/art/sources/`: `pnpm run models:pieces` (STL → road, settlement, city) and `pnpm run models:dice` (`Dice.obj` → `die.glb`). The die model is not mapped in the theme until its license is recorded in `docs/art/sources/dice/SOURCE.md`; until then the game draws a built-in die.

App icons, `favicon.ico` and the link-preview image (`og-image.png`) are generated from `apps/client/brand/icon.png`. After changing that image, run `pnpm run icons:build` and commit the files it writes to `apps/client/public/`.

`assets/` holds third-party reference images. It is git-ignored and is never built, committed or deployed. The shipped art lives in `apps/client/public/themes/`.
