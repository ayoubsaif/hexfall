## Context

The repository is empty. `proposal.md` explains why this change exists: a monorepo whose package boundaries enforce a pure, server-authoritative rules engine, a thin 3D client, and swappable assets. This document covers how the scaffold is built. The rules of asset resolution are in `specs/asset-theming`, and this document does not repeat them.

Constraints that shape every decision below:

- **Hidden information** (hands, dev cards, random steals) means the server is authoritative. The engine is a pure deterministic state machine. Its seeded RNG state lives inside game state, and the seed never leaves the server.
- **Hosting targets** (set up in the later `deploy` change): a static client on Vercel, a single-node WebSocket server on Fly.io, and managed Redis (e.g. Upstash). Vercel cannot hold long-lived WebSockets. Free tiers may sleep or restart the server, so Redis is the source of truth (built in `game-server`).
- **Toolchain**: Vite+ (`vp`), TypeScript everywhere, React + R3F + drei + zustand, Node + `ws`, Redis, zod.

## Goals / Non-Goals

**Goals**
- A workspace layout where the dependency direction `client -> protocol -> engine <- server` is enforced by tooling, not just by convention.
- One command each for dev, check, test and build across all workspaces.
- Fast inner loop: editing engine source is reflected in the client and server immediately, with no package rebuild step.
- A client and a server that start, connect over WebSocket and exchange a versioned hello/ping. The client renders an empty scene through the theme layer.
- Config only through env vars, so the `deploy` change is configuration work, not refactoring.

**Non-Goals**
- Any game rules, board topology, rooms, persistence schema or redaction (later changes).
- Deploy configuration (Vercel/Fly files, CI pipelines, origin lock hardening).
- Final art, animation or HUD design.
- Multi-node server scaling.

## Decisions

### 1. Monorepo layout and package manager

```
hexfall/
+-- package.json            root: private, workspace scripts, devDeps (vite-plus, typescript)
+-- pnpm-workspace.yaml     packages/*, apps/*
+-- tsconfig.base.json      shared compiler options
+-- vite.config.ts          Vite+ root config (lint/fmt/test/task settings)
+-- docker-compose.yml      local Redis only
+-- .env.example            documents every env var
+-- assets/                 THIRD-PARTY REFERENCE ONLY - excluded from everything (see 10)
+-- openspec/
+-- packages/
|   +-- engine/             pure rules engine, zero runtime deps
|   |   +-- src/  (index.ts, rng.ts, ...)
|   |   +-- test/
|   +-- protocol/           wire envelope + zod schemas; deps: engine (types), zod
|       +-- src/  (envelope.ts, messages/, index.ts)
+-- apps/
    +-- server/             Node + ws + redis; deps: engine, protocol
    |   +-- src/  (main.ts, config.ts, http.ts, ws.ts, redis.ts)
    +-- client/             React + R3F; deps: protocol, engine (types/pure helpers)
        +-- src/
        |   +-- net/        WebSocket connection + message decode
        |   +-- store/      zustand stores
        |   +-- scene/      R3F components (Canvas, board, pieces)
        |   +-- hud/        DOM overlay
        |   +-- theme/      theme layer (see 6)
        +-- public/themes/<name>/theme.json + *.glb
```

**Package manager: pnpm workspaces.** Vite+ is designed around existing package managers, and pnpm is the best fit with it. Its strict, non-hoisted `node_modules` means a workspace can only import what it declares. That backs up the dependency rule: if `apps/client` forgets to declare `ws`, the import fails instead of resolving through hoisting. The `workspace:*` protocol makes internal links explicit. pnpm is also well supported on Vercel and in Docker builds.

*Alternatives:* npm workspaces (hoisting hides undeclared deps, slower); Bun (fast, but adds a second runtime next to Node, and server parity with Fly's Node image matters more); Yarn PnP (strict, but tooling friction with editors and some 3D/loader packages).

Scope `@hexfall/*` (`@hexfall/engine`, `@hexfall/protocol`, `@hexfall/server`, `@hexfall/client`). The two apps are `private`.

### 2. Enforcing the dependency direction

The rule is enforced in layers, so that no single tool is load-bearing:

| Layer | Mechanism | Catches |
|---|---|---|
| Declared deps | Each `package.json` lists only allowed internal deps. Combined with pnpm strictness, an undeclared import fails to resolve. | client -> server, engine -> anything |
| TS project references | Each workspace's `tsconfig` `references` only its allowed upstream packages. `tsc -b` refuses to typecheck a reference that is not declared. | Cross-package type leaks |
| Lint import restrictions | Oxlint `no-restricted-imports` rules per workspace: engine bans `node:*`, `fs`, `ws`, `react`, `three`, `zod` and any `@hexfall/*`; protocol bans `node:*` and `@hexfall/server` / `@hexfall/client`; client bans `ws`, `ioredis`/`redis`, `@hexfall/server` and engine internals that are not exported. | Accidental imports, at edit time |
| Engine purity check | The engine's `tsconfig` sets `lib: ["ES2023"]` with **no `DOM`** and `types: []` (no `@types/node`). Any use of `window`, `document`, `process`, `Buffer`, `setTimeout` or `fetch` is then a type error. A small `check:engine` task also fails if `packages/engine/package.json` has a non-empty `dependencies` or `peerDependencies`. | Hidden I/O, wall-clock or ambient randomness |
| Engine lint | Ban `Math.random` and `Date.now` / `new Date()` in engine source. All randomness goes through the seeded RNG in state. | Non-determinism |

The client may import engine **types** and **pure helpers** (e.g. hex coordinate math) only through the engine's public `exports`. It never calls the reducer/legality functions to decide what is allowed. Legal moves arrive from the server in the player view (`game-server`/`client-3d`). This is a code-review rule as well as a lint rule. The lint restricts imports to an explicit allow-listed subpath (e.g. `@hexfall/engine/geometry`, plus `import type` from the root).

*Alternatives:* dependency-cruiser or Nx module-boundary rules. They are more expressive, but they add tools outside Vite+. Revisit if the Oxlint rules prove insufficient.

### 3. TypeScript config and how internal packages are consumed

- `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `target/lib ES2023`, `module: ESNext`, `moduleResolution: bundler`, `noEmit` by default. Each workspace extends it and adds only `lib`/`types` (DOM for client, Node for server, none for engine).
- **ESM only.** Every package has `"type": "module"`. There is no CJS output and no dual packages.
- **Internal packages are consumed as TypeScript source.** `@hexfall/engine` and `@hexfall/protocol` point `exports` straight at `src/*.ts`, and there is no prebuild step. With `moduleResolution: bundler`, `tsc`, Vite (client), Vitest and the server bundler all resolve these exports natively.

*Why source-level:* engine changes show up in client HMR and in server watch mode instantly, with no `build --watch` processes to keep in sync and no stale `dist/`. The cost is that a consumer must be able to compile TS. That is true for every consumer here: the client is bundled by Vite and the server is bundled (decision 4). Neither library is published to npm.

*Alternative considered:* prebuilt `dist/` per package (tsdown) with `.d.ts`. Cleaner for publishing, but it adds a build graph to the inner loop and a class of "forgot to rebuild" bugs. We can switch later by adding an `exports` condition, without changing any consumer.

`moduleResolution: bundler` is accepted for the server too, because the server is bundled into one artifact, not run by raw Node resolution.

### 4. Vite+ usage and the server build

Root-level tasks, run through the Vite+ task runner across workspaces:

| Command | Does |
|---|---|
| `vp dev` | Starts the client dev server (Vite) and the server in watch mode, in parallel. Expects Redis from `docker compose up -d`. |
| `vp check` | Oxlint + Oxfmt check + typecheck (`tsc -b`) + `check:engine` purity task. Fails CI on any issue. |
| `vp test` | Vitest in every workspace (engine first in importance; see 5). |
| `vp build` | Client: Vite static build to `apps/client/dist`. Server: single bundled ESM file to `apps/server/dist`. Engine/protocol: no build (typecheck only). |

**Server build: bundle with tsdown (Rolldown) to one ESM file. Don't use tsx at runtime.** Bundling inlines `@hexfall/engine`/`@hexfall/protocol` source (which is consumed as TS, see 3) and leaves real npm deps (`ws`, Redis client) external. Production runs plain `node dist/main.js`, so it doesn't depend on a TS loader, starts quickly after a free-tier wake-up, and keeps the Fly image small. For dev, the server runs in watch mode (tsdown watch + node restart, or Node's `--watch` on the bundle). tsx would also be acceptable for dev only, but we pick one path so that dev and prod resolve modules the same way.

*Alternatives:* `tsx` in production (simpler, but a runtime transpiler in prod and slower cold start); `tsc` emit (fails on extensionless source imports and would need the internal packages prebuilt).

Exact `vp` config keys and task-definition syntax are left to implementation (see Risks). This design fixes only the four task names and what each one must do.

### 5. Testing

- Vitest in every workspace, configured through Vite+. Tests live next to the workspace (`test/` or `*.test.ts`).
- **Engine is the heaviest suite.** In this change: an RNG stub test (same seed + same call sequence gives the same output; RNG state round-trips through JSON serialization). `rules-engine` later adds one suite per rule area.
- **Determinism in tests:** tests never mock `Math.random`. They build state from a fixed seed through an engine test helper (e.g. `makeState({ seed: 42 })`), and the RNG advances only through state. Golden-sequence tests pin the first N outputs of the RNG for a known seed, so an accidental algorithm change is caught.
- Protocol: schema round-trip tests (valid messages parse, malformed or wrong-version messages reject).
- Server: a smoke test that starts on an ephemeral port, hits `/healthz`, opens a WebSocket and completes hello/ping. Redis is either the docker-compose instance or skipped behind an env flag. No game logic.
- Client: environment `jsdom` (or `happy-dom`) for store/net/theme-resolution unit tests. Rendering R3F in tests is out of scope. Theme fallback logic is tested as pure functions.

### 6. Client skeleton

```
 WebSocket --> net/connection.ts --(zod decode via @hexfall/protocol)--> store (zustand)
                                                                           |
                       +---------------------------------------------------+
                       v                                                   v
          <Canvas> (R3F)  scene/*                                 hud/* (DOM overlay)
                       |                                                   |
                       +--> theme/useAsset("tile.forest") ---> GLB or      +--> user intent
                                                              procedural       |
                                                              fallback         v
                                                                     net/send(intent)
```

- **Layout:** one full-viewport `<Canvas>` with an absolutely positioned DOM HUD on top. The HUD is plain React, not drei `<Html>`, so it stays accessible and cheap to render.
- **State:** zustand stores. A `connection` store holds status, latency and protocol version. A `game` store holds the last player view from the server (empty in this change). Network messages are the only writers to the game store. Components read through selectors, and R3F components subscribe narrowly to avoid re-rendering the whole canvas.
- **Intents:** the HUD/scene send intents through `net/send`. The client never mutates game state optimistically and never decides legality.
- **Theme layer (`src/theme/`)** is the only module that knows about files, GLBs or the manifest. Scene code imports only from it:
  - `ThemeProvider`: loads `public/themes/<name>/theme.json` on startup (theme name from config, default theme bundled), validates it with zod, and exposes the resolved key map.
  - `useAsset(key)` / `<Asset assetKey="piece.settlement" playerColor=... />`: resolves through the manifest, loads with drei's GLTF loader inside Suspense plus an error boundary, and applies `PlayerColor` tinting.
  - `fallbacks/`: one procedural component per key (extruded hex, simple primitives). These are used when a key is missing from the manifest, while a model is loading, or when a load fails.
  - The key list, model contract (Y-up, 1 unit = hex circumradius, pointy-top, y=0 base), tint rule and fallback rules: see `specs/asset-theming`.
  - Manifest shape, illustrative only:
    ```json
    { "name": "diorama", "version": 1,
      "assets": { "tile.forest": { "model": "tile_forest.glb", "scale": 1 } } }
    ```
- Swapping models later means adding a new `themes/<name>/` folder or editing `theme.json`. No scene code changes.

### 7. Server skeleton

- **One port, one Node `http.Server`.** `GET /healthz` returns 200 with `{ ok, redis: "up"|"down", version }`. Every other path returns 404. The `ws` server attaches in `noServer` mode and handles `upgrade` on `/ws`. Using a single port fits Fly's single internal port and its HTTP health checks.
- **Origin check on upgrade:** reject upgrades whose `Origin` is not in `ALLOWED_ORIGIN` (comma-separated). Locally this defaults to the Vite dev origin. Hardening comes in `deploy`.
- **Config:** `config.ts` reads and validates env once at boot with zod (`PORT` default 8080, `REDIS_URL` default `redis://localhost:6379`, `ALLOWED_ORIGIN`, `NODE_ENV`). Invalid config makes the process exit with a clear message. No other module reads `process.env`.
- **Redis:** one client created at boot, using `rediss://` when the URL says so (Upstash requires TLS), with reconnect on drop. Health reports Redis status. The server stays up while Redis reconnects, but later changes must not accept game actions while Redis is down. Client library (ioredis vs node-redis) is chosen at implementation; it is used only behind a tiny `redis.ts` module.
- **Graceful shutdown:** on `SIGTERM`/`SIGINT`, stop accepting connections, close every socket with a "server restarting" close code (so clients reconnect, which matters for Fly restarts), close Redis, and exit. A hard timeout (around 10 s) forces the exit.
- **Heartbeat:** ws ping/pong on an interval terminates dead sockets. The protocol-level ping (decision 8) is separate and measures app-level latency.
- No rooms, games or persistence in this change.

### 8. Protocol skeleton

- **Envelope:** every frame is JSON `{ v, type, seq, payload }`.
  - `v`: protocol version (integer). The server rejects a mismatched `v` with a typed error and closes. The client shows a "please reload" message. This handles a stale client cached in a Vercel deployment while the server has moved on.
  - `type`: discriminator string.
  - `seq`: per-sender monotonically increasing integer. It is used for ordering and for matching replies (`re` field on replies is allowed by the envelope). Later it becomes the basis for idempotent intents and resume.
  - `payload`: type-specific, validated by a zod schema.
- Schemas are defined once in `@hexfall/protocol` as a zod discriminated union per direction (`ClientMessage`, `ServerMessage`), and TS types come from `z.infer`. Both sides decode every inbound frame with `safeParse`. Invalid frames get an `error` reply and are never trusted.
- Messages in this change: `hello` (client -> server: client version), `welcome` (server -> client: server version, protocol `v`), `ping`/`pong` (latency), `error` (code + message).
- The protocol package may reference engine **types** (for future player views) but contains no logic beyond schemas and encode/decode helpers.

### 9. Environment and config

| Where | Variable | Notes |
|---|---|---|
| Client (build time) | `VITE_SERVER_URL` | WebSocket base URL, e.g. `ws://localhost:8080` locally, `wss://<app>.fly.dev` in production. Set in Vercel project env later. Defaults to localhost when unset in dev. |
| Client (build time) | `VITE_THEME` | Optional theme name, default `diorama`. |
| Server | `PORT`, `REDIS_URL`, `ALLOWED_ORIGIN`, `NODE_ENV` | Set as Fly secrets/env later. |

- `VITE_*` values are public and baked into the static bundle. Secrets never go there.
- `.env.example` documents everything. Real `.env*` files are git-ignored. The server does not auto-load `.env` in production (Fly injects env). In dev, it loads `.env` through Node's `--env-file`.
- Nothing in this change hardcodes a hostname, which is enough for `deploy` to be configuration-only.

### 10. Excluding `assets/`

`assets/` holds third-party reference images from the commercial product. They must never be shipped, bundled, served or used as textures. We use a location-plus-tooling approach:

- The folder sits at the repo root, outside every workspace. Vite only serves and copies `apps/client/public`, so it can't pick up the files by accident. Workspace globs (`packages/*`, `apps/*`) never include it.
- It is excluded from tsconfig `include`, Oxlint/Oxfmt ignore lists, Vitest globs, and the future Docker build context (`.dockerignore`) and Vercel upload (`.vercelignore`) in `deploy`.
- `vp check` includes a check that fails if any file under `apps/` or `packages/` references the path `assets/` at the repo root, or if `apps/client/public/themes/` contains model files not referenced by that theme's manifest (other public files such as the favicon are not checked). Licensing for real game assets is tracked per theme (`specs/asset-theming`).

*Alternative:* move the folder out of the repo entirely. This is safer, but the user keeps it there as a rules/visual reference. Exclusion keeps that convenience.

## Risks / Trade-offs

- [Vite+ is young; config keys, task-runner semantics and Rolldown/tsdown integration may differ from what this design assumes] → This design fixes only task names and behavior, not syntax. Implementation checks current Vite+ docs first. Every task maps to a plain tool (`vite`, `vitest`, `oxlint`, `tsc`, `tsdown`), so if a Vite+ feature is missing or broken, a root `package.json` script can stand in without changing the architecture.
- [Source-level TS packages couple consumers to a TS-capable build] → Every consumer is already bundled. If a non-bundled consumer appears, add a prebuilt `exports` condition.
- [Oxlint import restrictions may be less expressive than ESLint's boundary plugins] → The rules are layered (decision 2), so pnpm strictness and TS project references still block violations if a lint rule has a gap.
- [Free-tier server sleep/restart drops all sockets] → Graceful close codes, client auto-reconnect with backoff, `/healthz` for platform probes. Redis remains the source of truth (`game-server`).
- [Upstash requires TLS and has request quotas] → `rediss://` support from day one. A future persistence design batches writes (snapshot + append log) to respect quotas.
- [R3F + three + drei bundle size hurts first load on mobile] → Import drei per module, lazy-load the game scene route, keep GLBs low-poly with Draco/meshopt compression, and track bundle size in `vp build` output.
- [Stale client after a deploy talks an old protocol] → `v` in the envelope, explicit mismatch error, "reload" UI.
- [CC0 asset quality is inconsistent and its provenance can be unclear] → Every key has a procedural fallback, so the game never blocks on art. Each theme records source + license per asset (see `specs/asset-theming`). Original or CC0 assets only. Nothing derived from `assets/`.
- [Client imports engine helpers and drifts into legality logic] → Allow-listed subpath exports + lint rule + review rule. Legal moves always come from the server.

## Open Questions

- ioredis vs node-redis: pick at implementation. It is isolated behind `redis.ts`.
- Client test DOM: `jsdom` or `happy-dom`. This doesn't matter until `client-3d`.
- Whether Vite+'s task runner can run `dev` for both apps in parallel with prefixed output, or whether a small root script is needed. This is decided when Vite+ is installed.
- GLB compression (Draco vs meshopt) is deferred until real models exist.

## Implementation Notes (Vite+ 1.5.0)

Recorded during task 1.1, from the current Vite+ docs and a reference `vp create vite:monorepo` scaffold. Vite+ version used: **vite-plus 1.5.0** (Node 24.20, pnpm 12).

- **Built-in commands can't be redefined.** `vp dev`, `vp check`, `vp test` and `vp build` always run the built-in tool on a single package. The four root tasks from decision 4 are therefore root `package.json` scripts, invoked as `vp run dev|check|test|build` (or `vpr <task>`). They fan out with `vp run -r` and `--filter` / `--parallel`.
- **Type checking runs inside `vp check`** (`lint.options.typeAware` + `typeCheck`, through tsgolint) and uses each file's nearest `tsconfig.json`. TypeScript is **v7** (the native `tsgo` compiler).
- **Lint and format config live only in the root `vite.config.ts`.** Per-workspace rules (decision 2) are `lint.overrides` entries matched by glob (`packages/engine/**`, ...). Per-package `vite.config.ts` files are only for Vite, Vitest and pack settings.
- **Tests import from `vite-plus/test`**, not `vitest`, enforced by the `vite-plus/prefer-vite-plus-imports` lint rule.
- **The server build uses `vp pack`** (tsdown) to produce a single ESM bundle. This matches decision 4.
- **Pinned versions:** a pnpm `catalog` pins `vite` to `npm:@voidzero-dev/vite-plus-core` and pins `vite-plus`, so Vite plugins such as `@vitejs/plugin-react` resolve to the Vite+ core.
- **Imports use explicit `.ts` extensions** (`allowImportingTsExtensions`, `erasableSyntaxOnly`), which also keeps source runnable by Node 24's built-in type stripping.
- **Deviation: no TS project references.** With TS 7, internal packages consumed as source and `noEmit`, project references would require `composite` and declaration emit, which brings back the build step decision 3 avoids. Type checking is done per file by `vp check` using the nearest `tsconfig.json` (engine: `lib: ES2023`, `types: []`). Dependency direction is still enforced by pnpm strict resolution (undeclared packages fail to resolve: verified), per-workspace `no-restricted-imports` overrides (verified with probe imports in all four workspaces) and `tools/check-engine.mjs`.

## Verification Log (apply, 2026-11-04)

- `vp run check`: format, lint and types clean across 56 files; `check-engine` OK; `check-assets` OK.
- `vp run test`: 106 tests pass. Engine 10, protocol 14, server 25 (+1 opt-in real-Redis test), client 57. The real-Redis test passes against both docker-compose Redis (WSL) and an Upstash `rediss://` database.
- `vp run build`: client static build and server single-file bundle `apps/server/dist/main.mjs`. No reference-art file names appear in either `dist/`.
- `vp run dev`: client (5173) and server (8080) start together. A live WebSocket hello→welcome and ping→pong works with `Origin: http://localhost:5173`. Server reconnected to Redis after `docker restart`.
- Browser (Chrome): the debug scene renders every asset key procedurally, the HUD shows "Connected" + latency, and the console has no errors. With `tile.hills` mapped to a missing GLB, the hills tile falls back to procedural and a warning names the key and theme. Other keys are unaffected.
- Fixes made during verification:
  - `redis.status()` now reports "down" immediately after `quit()`.
  - The client `optimizeDeps.include` lists the heavy deps, which prevents a stale-cache "504 Outdated Optimize Dep" blank page.
  - docker-compose Redis has `restart: unless-stopped`, because WSL stops idle containers.
- Not verifiable on Windows: delivering a real SIGTERM to a running node process. Graceful shutdown (close 1012) is verified through the shutdown function in tests. Re-check on Fly/Linux in `deploy`.
- The repo is not a git repository yet, so "from a clean clone" was run from the working tree.
