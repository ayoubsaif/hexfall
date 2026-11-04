## Why

Hexfall (working title) is an online, 3–4 player, human-only implementation of the Catan base game rules (5th edition, 2020 rulebook, as specified in the project's AGENTS.md). It ships with an original visual identity: no Catan name, logo or official artwork. The repository is empty. Before any rules, server or 3D work can start, we need a monorepo whose package boundaries enforce the core architecture. The rules engine stays pure and server-authoritative. The client is a thin renderer. 3D assets are swappable from the first day, so the MVP can ship with simple low-poly art and get better models in a later upgrade.

## What Changes

- Create a **Vite+ (`vp`) monorepo** with shared TypeScript, lint (Oxlint), format (Oxfmt) and test (Vitest) configuration, plus one task runner for all workspaces.
- Add four workspaces with one-way dependencies (`client -> protocol -> engine <- server`):
  - `packages/engine`: pure, deterministic rules engine. No I/O and no runtime dependencies. Empty skeleton plus a seeded RNG stub.
  - `packages/protocol`: wire types and runtime schemas (zod) for client intents, server messages and per-player views. Skeleton only.
  - `apps/server`: Node WebSocket server skeleton with a health endpoint and a Redis connection (local Redis via docker-compose for development).
  - `apps/client`: React + React Three Fiber (+ drei, zustand) app that renders an empty scene and connects to the server.
- Add the **asset theme layer** to the client. Scene components ask for assets by key (`tile.forest`, `piece.settlement`, …). A theme manifest resolves each key to a GLB. Every key also has a procedural fallback, so the game works with no art. MVP art direction: low-poly diorama using original or CC0 assets only.
- Add CI-ready scripts: `vp check` (lint, format, typecheck) and `vp test` across all workspaces.
- Keep the `assets/` reference images out of the build and out of the shipped game. They belong to a third-party product and must not be used as game art.

## Capabilities

### New Capabilities
- `asset-theming`: How the 3D client resolves visual assets by key through a theme manifest. Covers the coordinate/scale/orientation contract for models, runtime player-color tinting, and procedural fallbacks when an asset is missing or fails to load.

### Modified Capabilities
<!-- None: no existing specs. -->

## Impact

- **New code**: the entire repo layout (`packages/engine`, `packages/protocol`, `apps/server`, `apps/client`), root workspace config, docker-compose for local Redis.
- **Dependencies**: Vite+ toolchain, TypeScript, React, three, @react-three/fiber, @react-three/drei, zustand, zod, ws, a Redis client (ioredis or node-redis).
- **Infrastructure targets** (configured in a later change): client as a static build on Vercel, server on Fly.io (single node for the MVP), managed Redis (e.g. Upstash free tier). The WebSocket server cannot run on Vercel.

## Roadmap (follow-up changes)

| # | Change | Scope |
|---|---|---|
| 2 | `board-topology` | Axial coordinates, 19 hexes / 54 intersections / 72 paths, harbor slots, beginner and variable setup |
| 3 | `rules-engine` | All rules in AGENTS.md §5–§12, legal-move generation, event log, one test suite per §13 item |
| 4 | `game-server` | Rooms with share links, anonymous seat tokens, Redis event log + snapshots, per-player redaction, reconnect |
| 5 | `client-3d` | R3F board on the theme layer, legal-move picking, React HUD |
| 6 | `trading` | Domestic offer/accept/reject/counter flow and maritime trade UI |
| 7 | `deploy` | Vercel + Fly config, origin lock, health checks |

## Decisions carried forward

These are specified in later changes and recorded here so they aren't reopened:
- **Longest Road**: if the holder's road is broken but they are still tied for the longest road, they keep the card.
- **Hidden VP cards**: the active player sees a "Reveal & win" action only when revealing would bring them to 10 or more VP. The win is never applied automatically.
- **Disconnects**: if a required decision is waiting on a disconnected player (discard, trade response), the game pauses. There are no auto-actions (they would be house rules).

## Non-goals (MVP)

Bots, hot-seat play, accounts, spectators, chat, replay viewer, multi-node scaling, sound, polished animations, expansions.
