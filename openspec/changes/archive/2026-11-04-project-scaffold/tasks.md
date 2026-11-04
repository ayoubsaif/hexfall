## 1. Workspace foundation

- [x] 1.1 Check the current Vite+ docs (install, `vp` task definitions, pnpm integration) and note in this change any differences from design.md §4; verify by recording the Vite+ version used
- [x] 1.2 Create root `package.json` (private, ESM), `pnpm-workspace.yaml` (`packages/*`, `apps/*`), `.gitignore` (incl. `.env*` except `.env.example`), and install Vite+ + TypeScript; verify `pnpm install` succeeds and `vp --version` runs
- [x] 1.3 Add `tsconfig.base.json` with the strict options from design.md §3 (ESM, `moduleResolution: bundler`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`); verify an empty `tsc -b` passes
- [x] 1.4 Scaffold the four workspaces `@hexfall/engine`, `@hexfall/protocol`, `@hexfall/server`, `@hexfall/client`, each with `package.json` (`workspace:*` internal deps only as allowed), `tsconfig.json` extending the base with project references pointing only upstream; verify `pnpm -r ls` shows the expected graph
- [x] 1.5 Configure engine and protocol `exports` to point at `src/*.ts` (no build step), plus the allow-listed `@hexfall/engine/geometry` subpath; verify the client and server both resolve imports from them in `tsc -b`
- [x] 1.6 Add `docker-compose.yml` (Redis only) and `.env.example` documenting `VITE_SERVER_URL`, `VITE_THEME`, `PORT`, `REDIS_URL`, `ALLOWED_ORIGIN`, `NODE_ENV`; verify `docker compose up -d` gives a Redis that answers `PING`

## 2. Tooling tasks and boundary enforcement

- [x] 2.1 Define root tasks `vp dev`, `vp check`, `vp test`, `vp build` (falling back to root scripts where Vite+ lacks a feature, per design.md Risks); verify each command runs on the empty workspaces
- [x] 2.2 Configure Oxlint and Oxfmt with ignore lists covering `assets/`, `dist/`, `openspec/`; verify `vp check` passes on a clean tree and fails on a deliberately misformatted file
- [x] 2.3 Add per-workspace `no-restricted-imports` rules (engine bans `node:*`/`react`/`three`/`ws`/`zod`/`@hexfall/*`; protocol bans `node:*` and app packages; client bans `ws`, Redis clients, `@hexfall/server`, non-allow-listed engine paths); verify with a temporary forbidden import per workspace that `vp check` fails
- [x] 2.4 Set engine `tsconfig` to `lib: ["ES2023"]`, `types: []` and lint-ban `Math.random`, `Date.now`, `new Date()` in engine source; verify a temporary use of `process`, `window` or `Math.random` fails `vp check`
- [x] 2.5 Add the `check:engine` task that fails if `packages/engine/package.json` has non-empty `dependencies`/`peerDependencies`, and wire it into `vp check`; verify by temporarily adding a dependency
- [x] 2.6 Add the reference-art guard to `vp check`: fail if any file under `apps/` or `packages/` references the root `assets/` path, or if `apps/client/public/themes/` holds model files not referenced by its theme manifest; verify with a temporary offending reference

## 3. Engine and protocol skeletons

- [x] 3.1 Implement the engine seeded RNG stub whose state is plain serializable data, plus a `makeState({ seed })` test helper; verify Vitest tests cover same seed → same sequence, a pinned golden sequence for a known seed, and JSON round-trip of RNG state continuing the same sequence
- [x] 3.2 Implement the protocol envelope `{ v, type, seq, payload }` and zod discriminated unions `ClientMessage` (`hello`, `ping`) and `ServerMessage` (`welcome`, `pong`, `error`) with encode/decode helpers; verify round-trip tests pass and malformed or wrong-`v` frames are rejected

## 4. Server skeleton

- [x] 4.1 Add `config.ts` that validates env once at boot (defaults: `PORT` 8080, `REDIS_URL` `redis://localhost:6379`) and exits with a clear message on invalid config; verify a unit test for valid and invalid env
- [x] 4.2 Add `redis.ts` (choose ioredis or node-redis; supports `rediss://`, reconnects on drop) used only through this module; verify the server connects to docker-compose Redis and logs reconnect after `docker compose restart`
- [x] 4.3 Serve `GET /healthz` → `{ ok, redis, version }` and 404 elsewhere on a single HTTP server, with `ws` upgrade on `/ws` rejecting origins outside `ALLOWED_ORIGIN`; verify with curl and a WebSocket attempt from a disallowed origin
- [x] 4.4 Handle `hello` → `welcome`, `ping` → `pong`, invalid frames → `error`, protocol `v` mismatch → `error` + close, plus a ws-level heartbeat that terminates dead sockets; verify with a Vitest smoke test on an ephemeral port
- [x] 4.5 Implement graceful shutdown on SIGTERM/SIGINT (close sockets with a "server restarting" code, close Redis, hard timeout about 10 s); verify a connected client receives the close code when the process is stopped
- [x] 4.6 Bundle the server with tsdown into one ESM file (internal packages inlined, npm deps external); verify `vp build` then `node apps/server/dist/main.mjs` serves `/healthz`

## 5. Client skeleton

- [x] 5.1 Create the Vite React app with a full-viewport R3F `<Canvas>` (camera, lights, empty sea plane) and an absolutely positioned DOM HUD; verify `vp dev` renders the scene in the browser with no console errors
- [x] 5.2 Add `net/` connection (URL from `VITE_SERVER_URL`, zod decode of every inbound frame, auto-reconnect with backoff) and zustand `connection`/`game` stores written only by network messages; verify the HUD shows connected status + ping latency against the local server, and reconnects after a server restart
- [x] 5.3 Show a "please reload" HUD message when the server reports a protocol version mismatch; verify by bumping `v` locally

## 6. Asset theme layer (specs/asset-theming)

- [x] 6.1 Define the asset key set and the theme manifest schema (id, license/source, key → GLB, optional scale/rotation/offset overrides); verify unit tests: partial manifest valid, unknown keys ignored with a warning, invalid manifest → all procedural with an error
- [x] 6.2 Implement the `ThemeProvider` that loads the theme selected by `VITE_THEME` (default theme when unset or unknown, with a warning naming the missing id); verify unit tests for selection and the unknown-id fallback
- [x] 6.3 Implement procedural fallbacks for all 18 keys following the model coordinate contract (pointy-top hex, 1 unit = circumradius, top/base at y=0), with visually distinct terrains and harbor types; verify a debug scene renders every key with zero model files
- [x] 6.4 Implement asset resolution: themed GLB when mapped and loaded, fallback while loading, and fallback + warning (key and theme named) on missing/corrupt files without affecting other keys; verify unit tests on the resolution logic and a manual check with a deliberately broken file path
- [x] 6.5 Implement player-color tinting (`PlayerColor` material tinted; whole piece tinted when absent; robber never tinted) and per-asset transform overrides; verify the debug scene shows one piece model in four player colors and a scale override applies to only its key
- [x] 6.6 Ship the default `diorama` theme manifest with a license/source declaration (it may map zero or a few CC0 models at this stage); verify the client loads it and the scene renders
- [x] 6.7 Add the asset budget check to `vp check` (warn on non-compressed GLB or over about 300 KB; fail on a manifest referencing a missing file, a path into `assets/`, or a missing license); verify with temporary offending manifests

## 7. Integration check

- [x] 7.1 From a clean clone: `pnpm install`, `docker compose up -d`, `vp check`, `vp test`, `vp build` all pass, and `vp dev` shows the client connected to the server with the debug scene rendering procedural assets; verify by running the full sequence and recording the result in this change
- [x] 7.2 Confirm nothing from `assets/` appears in `apps/client/dist` or `apps/server/dist`; verify by searching the build outputs for the reference file names
