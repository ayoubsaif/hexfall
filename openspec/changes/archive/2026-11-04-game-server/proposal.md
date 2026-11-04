## Why

The rules engine can play a full game, but only inside one process. Players need to meet in a room, take seats, send actions over the network, and get back only what they are allowed to see. Games must also survive a server restart, since the free-tier host may sleep or restart at any time. This change makes the server the authority for real games.

## What Changes

- **Rooms.** A player creates a room and gets a short room code to share. Others join with the code and a display name. Seats are given in join order: the creator is seat 0 and plays first clockwise. A room holds 3 or 4 players. In the lobby, players can leave; if the host leaves, the next seat becomes host. The host starts the game, choosing the board mode (beginner or variable) and, optionally, a starting player. Without one, players roll for it as the engine requires.
- **Anonymous seat tokens.** Joining returns a secret seat token. Sending it back resumes the seat after a disconnect, a page reload or a server restart. The server stores only a hash of each token. A new connection with the same token replaces the old one.
- **Game actions over the protocol.** New client messages for create, join, resume, leave, start and game actions, and new server messages for room state, game updates and rejections. The server sets the acting seat from the connection, so a client can never act for another seat. Every action goes through `applyAction`. A rejected action returns the engine's rule error code to the sender only.
- **Per-player views.** After every accepted action, each connected player gets their own redacted view (`playerView`), their legal moves (`legalActions`) and the new log events. A full view with the whole log is sent on join and resume.
- **Persistence in Redis.** Redis is the source of truth: room metadata, the action log and periodic state snapshots. An action is persisted before anyone sees its result. If Redis is unavailable, actions and room changes are refused (state is unchanged). After a restart, a room is rebuilt from its snapshot plus the actions after it. Rooms expire after 14 days without activity.
- **Presence.** Every player sees who is connected. If the game waits on a disconnected player (their turn, a discard, a trade reply), it simply waits. There are no automatic actions.
- **Limits.** Per-connection message rate limit and name validation.

Out of scope:
- Any client UI or client store changes (`client-3d`, `trading`). The existing client keeps working with hello/ping.
- Spectators, chat, kicking players, replacing a player who never returns, and time limits.
- Deployment config (`deploy`).

## Capabilities

### New Capabilities
- `game-server`: rooms and lobby, seat tokens and resume, authoritative action handling, per-player redacted updates, presence, persistence and recovery in Redis, and the related protocol messages.

### Modified Capabilities

(none — the scaffold's connection behavior is not a spec yet, and hello/ping stay as they are)

## Impact

- `packages/protocol`: new message schemas for rooms and games, including a structural schema for engine actions. `PROTOCOL_VERSION` goes from 1 to 2, which is **BREAKING** for the wire format. The client and server are built together, so this needs no migration.
- `apps/server`: new room, store and session modules; `server.ts` routes the new messages; `redis.ts` exposes the commands the store needs; `/healthz` also reports the number of loaded rooms.
- `packages/engine`: no rule changes. It may get small additive exports if the server needs them.
- Redis usage: about 2–3 commands per action, plus a snapshot every 25 actions, to respect Upstash quotas.
- No new dependencies (`ws`, `ioredis` and `zod` are already present; tokens use `node:crypto`).
