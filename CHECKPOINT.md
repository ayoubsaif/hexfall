# Hexfall: session checkpoint (2026-11-04)

Hexfall (working title) is an online, 3–4 player, human-only implementation of the Catan base-game rules (5th edition, 2020 rulebook, as specified in the user's AGENTS.md rules text). It has an **original visual identity**: no Catan name, logo or official art.

## Done
- `project-scaffold` is implemented and archived: `openspec/changes/archive/2026-11-04-project-scaffold/`.
- Main spec: `openspec/specs/asset-theming/spec.md`.
- Monorepo: Vite+ 1.5.0 (`vp`), pnpm 12, TypeScript 7, Node 24.
  - `packages/engine`: pure; seeded sfc32 RNG with state kept inside game state.
  - `packages/protocol`: zod envelope `{v, type, seq, re?, payload}`.
  - `apps/server`: Node + ws + ioredis; `/healthz`, `/ws` with origin check, graceful close code 1012.
  - `apps/client`: React 19 + R3F 9 + drei + zustand; HUD; theme layer with procedural fallbacks; debug scene.
- Root commands: `pnpm run check | test | build | dev`. All pass (106 tests).

## Run locally
1. Redis: `docker compose up -d`, run from WSL (`wsl --cd /mnt/g/games/catan -e docker compose up -d`; in Git Bash set `MSYS_NO_PATHCONV=1`).
2. `pnpm run dev`, then open http://localhost:5173 (server on :8080).
3. `.env` is git-ignored. `REDIS_URL` points at local Redis. A temporary Upstash database (expires 2026-11-07) is commented out in it.

## Next change: `board-topology` (not created yet; the user still has to confirm creating it)
Decisions already made with the user:
- **Board:** the full 19-hex island (3-4-5-4-3) in a sea frame with 9 harbor slots, replacing the 7-hex debug scene.
- **Layouts:** exactly as AGENTS.md says. Beginner fixed layout, plus variable setup (A–R counter-clockwise token spiral skipping the desert; harbors shuffled). No layouts copied from screenshots.
- **Tiles are flat 2D:**
  - Painted textures on flat hexes, with no 3D props on tiles.
  - Number tokens and harbors are drawn as flat markers.
  - Only roads, settlements, cities and the robber are 3D.
  - This needs a MODIFIED `asset-theming` requirement: `tile.*`/`sea` become image textures, and their fallback is a flat colored hex.
- **Tile art:** original painted top-down illustrations, generated without using any `assets/` image as input, and reviewed by the user before use.
- **Carried-forward rules:** the Longest Road holder keeps the card when still tied after a break; VP cards are revealed with a "Reveal & win" action (never auto-revealed); the game pauses if a required decision waits on a disconnected player.

## Hard constraints
- `assets/` holds official Catan artwork (third-party). **Never** use, trace or imitate it, or include it in builds. `tools/check-assets.mjs` enforces this.
- The user prefers multi-agent parallelism for implementation (disjoint file ownership; the lead agent owns shared config, the lockfile and tasks.md).

## Roadmap after board-topology
`rules-engine` → `game-server` (rooms, seat tokens, Redis event log) → `client-3d` → `trading` → `deploy` (Vercel client, Fly server, Upstash Redis).
