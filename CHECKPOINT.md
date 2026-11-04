# Hexfall: session checkpoint (2026-11-04)

Hexfall (working title) is an online, 3–4 player, human-only implementation of the Catan base-game rules (5th edition, 2020 rulebook, as specified in the user's AGENTS.md rules text). It has an **original visual identity**: no Catan name, logo or official art.

## Done

- `project-scaffold` is implemented and archived: `openspec/changes/archive/2026-11-04-project-scaffold/`.
- Main spec: `openspec/specs/asset-theming/spec.md`.
- Monorepo: Vite+ 1.5.0 (`vp`), pnpm 12, TypeScript 7, Node 24.
  - `packages/engine`: pure; seeded sfc32 RNG with state kept inside game state.
  - `packages/protocol`: zod envelope `{v, type, seq, re?, payload}`.
  - `apps/server`: Node + ws + ioredis; `/healthz`, `/ws` with origin check, graceful close code 1012.
  - `apps/client`: React 19 + R3F 9 + drei + zustand; HUD; theme layer with procedural fallbacks; board view.
- Root commands: `pnpm run check | test | build | dev`.

## Run locally

1. Redis: `docker compose up -d`, run from WSL (`wsl --cd /mnt/g/games/catan -e docker compose up -d`; in Git Bash set `MSYS_NO_PATHCONV=1`).
2. `pnpm run dev`, then open http://localhost:5173 (server on :8080).
3. `.env` is git-ignored. `REDIS_URL` points at local Redis. A temporary Upstash database (expires 2026-11-07) is commented out in it.

## `board-topology` (implemented, not yet archived)

Change: `openspec/changes/board-topology/`. All tasks are done; archive it with `/opsx:archive`.

- **Engine** (`packages/engine/src/topology.ts`, `board.ts`):
  - A frozen `TOPOLOGY` with 19 hexes, 54 intersections, 72 paths, 30 coastal paths and 9 harbor slots, using integer-lattice ids in reading order.
  - `beginnerBoard()` follows AGENTS.md §4a. `createVariableBoard(rng)` shuffles terrains, then harbors, then picks a corner, then lays the A–R spiral; that order is the replay contract.
  - The client imports these through `@hexfall/engine/geometry`.
- **Harbor-slot assumption:** the slots sit at coastal positions 0,3,6,10,13,16,20,23,26, clockwise from hex 0's upper-left side. AGENTS.md gives only the harbor order, so this is Hexfall's own frame. Change it if the real positions become known.
- **No beginner pre-placed pieces:** beginner games use the normal setup phase, because AGENTS.md says not to guess positions.
- **Client:**
  - The board view draws flat tiles, 18 sea tiles, number tokens (6 and 8 in red), harbor badges with links, and the robber.
  - The camera fits the whole board.
  - A HUD **Flat / 3D** board-style switch is saved in `localStorage` (`hexfall.boardStyle`). The default is flat on touch devices or when the smaller viewport side is under 768 px, and 3D otherwise.
- **Theme:**
  - Flat keys (`tile.*`, `sea`, `token`, `harbor.*`) map to `{ image }`; piece keys map to `{ model }`.
  - The 3D diorama fallbacks are kept for the 3D style.
  - `diorama` ships 6 AI-generated terrain WebPs (Creative Claw, text prompts only, approved by the owner) and a hand-written SVG sea.
- **Rules text:** AGENTS.md is restored at the repo root (and excluded from formatting).
- **Checks:** check, test and build all pass (204 tests).

## `rules-engine` (archived)

Archived: `openspec/changes/archive/2026-11-04-rules-engine/` (13/13 tasks); main spec `openspec/specs/rules-engine/spec.md`. All AGENTS.md §4c–§13 rules live in `packages/engine`.

- **API:** `createGame(config)`, `applyAction(state, action)` (returns the next state plus events, or a typed `RuleError` code; never mutates its input), `legalActions(state, seat)`, `playerView(state, seat | null)`.
- **Layout:** `state.ts` (types), `game.ts` (create, dispatch, end turn, victory, legal moves), `rules/` (`placement`, `longestRoad`, `setup`, `production`, `robber`, `devCards`, `largestArmy`, `trade`, `common`, `errors`), `view.ts`.
- **Rule interpretations** (design.md decision 6): hidden VP cards need an explicit `revealVictoryPoints`, which is legal only at 10+ VP; a player who reached 10 on another player's turn wins when their own turn starts; a steal victim may have an empty hand; trades, builds and purchases need the roll, but cards can be played before it.
- **Tests:** 191 engine tests, including a fuzz test of random legal play (every listed move is accepted, cards and pieces are conserved). Random games play to a win.

## `game-server` (archived)

Change: `openspec/changes/game-server/` (11/11 tasks). Server + protocol only; no client changes.

- **Protocol v2** (`packages/protocol`): `createRoom`, `joinRoom`, `resumeRoom`, `leaveRoom`, `startGame`, `gameAction` (engine action without `seat`); server sends `roomJoined`, `roomLeft`, `roomState`, `gameSnapshot`, `gameUpdate` (view with an empty log + new events + `logLength`), `actionRejected`. New close code 4001 (Replaced). **`client-3d` must adopt v2**: the current client only speaks hello/ping.
- **Server** (`apps/server/src`): `rooms/` (codes, `Room`, `RoomService`), `store/` (`memory.ts`, `redis.ts` with Lua compare-and-set, 14-day TTL, snapshot every 25 actions), `session.ts` (routing, 20/s rate limit). Seats in join order, host starts, no spectators, no auto-actions.
- **Checked:** 134 server tests with real Redis (`TEST_REDIS=1 REDIS_URL=redis://localhost:6379`), including a 3-client e2e game and a restart test. Manual check: a real server restart on Docker Redis, 3 clients resumed with identical views and played on.
- **WSL note:** WSL stops idle containers; keep a background `wsl ... sleep` running (or run `docker compose ps` right before) when testing against Redis.

## `client-3d` (implemented, manual check mostly done)

Change: `openspec/changes/client-3d/`. The client now plays real games over protocol v2.

- **Session** (`apps/client/src/net/session.ts`): create/join/resume/leave/start, seat tokens in `localStorage` (`hexfall.seats`, `hexfall.lastRoom`), `?room=CODE` invite links, auto-resume on every `welcome`, close code 4001 → "Play here", log-gap recovery by reconnecting, "back to start" after game over (fresh unseated connection, since the server only allows leaving in the lobby).
- **Stores**: `store/room.ts`, `store/game.ts` (server truth, written only by the session), `store/ui.ts` (player intent, cleared on every phase/turn change). `game/pick.ts` is the one place that decides what the board can pick.
- **Board** (`scene/Pieces.tsx`, `Targets.tsx`, `motion.ts`): pieces in seat colors (`game/colors.ts`), only legal targets highlighted, drag > 6 px is not a pick, robber victim choice, drop/tween/glow motion (off under reduced motion, none on snapshots).
- **HUD** (`hud/*`): start screen, lobby, panels, hand, turn bar with dice, build bar, development cards, discard / Year of Plenty / Monopoly / victim dialogs, maritime trade, event log, toasts, rejections, game over. The shell layout is now Tailwind in `hud/Hud.tsx` (see `hud-tailwind-cards` below).
- Domestic trading UI is still out of scope (`trading`).
- **Manual test helper**: a protocol bot that plays legal moves lived in the session scratchpad; recreate from the e2e test if needed. Run your own server/client on other ports when another session holds :5173 (`PORT=8090 ALLOWED_ORIGIN=http://localhost:5175` for the server, `VITE_SERVER_URL=ws://localhost:8090 pnpm exec vp dev --port 5175` in `apps/client`).
- **Same-browser note**: seat tokens are per browser origin, so two tabs of the same browser share one seat per room. Test multiple players with bots or separate browsers/profiles.

## `stl-piece-models` (implemented, not yet archived)

- Roads, settlements and cities in the `diorama` theme are now meshopt-compressed GLBs (`apps/client/public/themes/diorama/models/`, 35-100 KB each). They were converted from Printables STLs by Burgers (CC-BY-4.0, https://www.printables.com/@Burgers). The robber stays procedural.
- Sources and the attribution record are in `docs/art/sources/pieces/` (`SOURCE.md`). To regenerate the models, run `pnpm run models:pieces` (`tools/stl-to-glb.mjs`). The STLs are Z-up. The road is thinned to half its thickness (`crossScale: 0.5`), which the owner approved.
- `tools/` is now a workspace package (`@hexfall/tools`) with dev-only deps (`@gltf-transform/*`, `meshoptimizer`) and Vitest tests for the converter and for the `check-assets` license rules.
- Manifests may declare `credits`. `check-assets` enforces a license allowlist (no NC/ND) and requires a credit for every attribution-licensed asset. The HUD has a **Credits** button next to the Flat/3D switch.
- `check-assets` now matches `assets/` file stems only when the stem is distinctive (contains a digit, `-` or `_`). Before this, `settlement.stl` made every file mentioning "settlement" fail the check.

## `hud-tailwind-cards` (implemented, awaiting owner review)

Change: `openspec/changes/hud-tailwind-cards/`, new capability spec `hud-presentation`.

- **Styling stack**: Tailwind CSS v4 (`@tailwindcss/vite`, no config file) plus hand-copied shadcn/ui components in `apps/client/src/components/ui/` (Button, Card, Badge, Dialog, Sheet, Tooltip on Radix; `cn()` in `src/lib/utils.ts`; `@/` alias). The old `hud.css` / `layout.css` are gone.
- **Tokens** live in `apps/client/src/style.css` under `@theme static`: HUD colors (`hud`, `hud-solid`, `hud-fg`, `ok`/`wait`/`bad`, `accent`), resource frame colors (`res-*`), breakpoints (`sm` 640 px, `lg` 1024 px), the card/dialog/sheet keyframes. Custom variants: `short` (< 600 px high), `landscape` (short and ≥ 640 px wide), `desktop` (≥ 1024 × 600).
- **Layouts**: mobile (compact panels, log drawer, scrolling tray capped at 36 % height), tablet (log drawer, full-width tray), short-and-wide (board left, tray in a right-hand column), desktop (side log above a full-width tray; Flat/3D/Credits in the top bar).
- **Board framing**: the canvas is a full-screen background and the camera fits the island to the whole viewport; the HUD floats over it (owner decision: no resizing or offsetting the board around the HUD).
- **Cards**: `hud/cards/GameCard.tsx` draws resources and dev cards as physical cards. Resource art is cropped from the diorama tiles by `pnpm run cards:build` (`tools/cards-from-tiles.mjs`, sharp) into `apps/client/public/cards/*.webp` (320 × 448, 10-18 KB each).
- **Motion**: CSS only, at most 200 ms (card in 180 ms, card out 150 ms, dialogs 150 ms), never looping in the HUD, and off under `prefers-reduced-motion`.
- **Build size** (2026-11-04): client CSS 37.7 KB (7.8 KB gzip), JS 1,492 KB (424 KB gzip). No committed baseline exists to compare against, because the previous client work is uncommitted.
- **Known check failure**: `docs/art/minimal/build.mjs` fails `vp check` formatting (it predates this change). It stops `pnpm run check` before lint and the engine and asset checks, so run those directly until it is fixed.

## `dice-tray-3d` (implemented, awaiting WebKit check and owner review)

Change: `openspec/changes/dice-tray-3d/`. It modifies `game-hud` ("Dice display", "Turn status and controls") and `hud-presentation` ("Minimal motion"). **Archive order**: archive `client-3d` and `hud-tailwind-cards` first, because they introduce those two capabilities.

- **Where the dice live**: `apps/client/src/hud/dice/` holds `Die3d.tsx` (a CSS 3D cube in the Parchís style, after jico's MIT CodePen), `useDiceThrow.ts` (throw only for update rolls, never for snapshots or reduced motion) and `DiceTray.tsx`. The tray is the Roll dice / Roll for order button, and the turn bar keeps only the status and End turn.
- **Placement**: the tray docks at the bottom-right of the free board area. `Hud.tsx` measures the spot into `useDockStore` (`store/dock.ts`). The board is not resized for the dice.
- **Tokens** (`style.css` `@theme`): `die`, `die-rim`, `pip`, `pip-red`, and the `dice-tumble` (800 ms), `dice-bounce` (900 ms) and `dice-shadow` keyframes. The die size is the `--die` variable (44 px, or 36 px on compact screens).
- **Motion exception**: the dice throw is the only HUD animation over 200 ms (980 ms in total, capped at 1.2 s by the spec). It plays once per roll, and the `.hud` reduced-motion rule turns it off.

## Hard constraints

- `assets/` holds official Catan artwork (third-party). **Never** use, trace or imitate it, or include it in builds. `tools/check-assets.mjs` enforces this.
- The user prefers multi-agent parallelism for implementation (disjoint file ownership; the lead agent owns shared config, the lockfile and tasks.md).

## Roadmap

Next: finish and archive `client-3d`; archive `board-topology` (after the illustration work). After that: `trading` → `deploy` (Vercel client, Fly server, Upstash Redis).

## `floating-hud-turn-timer` (implemented; owner review open)

Change: `openspec/changes/floating-hud-turn-timer/`.

- **Archive order** (owner decision, 2026-11-04): this change was built first. Archive `client-3d`, `hud-tailwind-cards` and `dice-tray-3d`, in that order, before archiving it.
- **Timer presets:** the host picks Off, Standard (30 s to roll, 90 s idle) or Relaxed (60 s / 120 s) in the lobby. The choice is saved in `localStorage` as `hexfall.turnTimer`, and protocol `startGame.turnTimer` defaults to `off`.
- **`timeout` action** (`packages/engine/src/rules/timeout.ts`): a system-only engine action with no seat. It resolves the current wait using the state RNG, first emitting `timedOut {phase, seats}` and then the normal events. Clients can't send it, and it is never listed in legal moves. `endTurn` moved to `rules/turn.ts`.
- **Protocol v3:** `gameSnapshot` and `gameUpdate` carry `timer: {kind, durationMs, remainingMs, seats} | null`. The remaining time is measured on the server when each message is sent, and the client adds it to its own `performance.now()`.
- **Deadline anchor:**
  - Stored action records are now `{at, action}` (bare actions still load), and snapshots store `anchor`.
  - `apps/server/src/rooms/timer.ts` derives the deadline: it restarts when the phase or active player changes, or when a seat being waited on acts.
  - The room re-arms after a rebuild. A deadline that passed while the room was unloaded fires once.
- **HUD layout:**
  - Floating icon buttons (`hud/actions/`) are hidden on other players' turns. The End turn button carries the countdown ring.
  - The status pill floats above the hand (`hud/StatusPill.tsx`).
  - The edge hand sits half off the bottom edge, and development cards show only when held (`Hand.tsx`, `DevCards.tsx`, `GameCard layout="peek"`).
  - The your-turn overlay (`hud/TurnFocus.tsx`, `useTurnFocus.ts`) moves the dice to the center.
  - Layout is measured by `hudLayout()` in `store/dock.ts`, which publishes `--hud-bottom`, `--hand-h` and `--pill-*`.
- **Manual check (2026-11-04):** a browser host plus two protocol bots (scratchpad `bot.mjs`), server on :8090, client on :5176. Confirmed: roll for order, both setup placements, the automatic roll and the automatic end of turn all timed out correctly; the overlay opened and closed; rolling from the centered dice worked. Not seen live: an automatic discard or robber move for the idle player (the server e2e test and engine tests cover both).
