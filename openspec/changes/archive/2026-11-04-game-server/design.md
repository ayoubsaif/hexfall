## Context

- `apps/server` today has an HTTP server with `/healthz`, a `/ws` upgrade with an origin allow-list, hello/welcome and ping/pong, a heartbeat, graceful shutdown with close code 1012, and an ioredis client behind `redis.ts` that never crashes on outages.
- `packages/protocol` has a zod envelope `{v, type, seq, re?, payload}` and already depends on `@hexfall/engine`.
- The engine (`rules-engine`, archived) exposes `createGame`, `applyAction` (pure, JSON state, typed error codes), `legalActions` and `playerView`. All randomness lives in the state's seeded RNG, so a game can be rebuilt from its config plus its action list.
- Hosting: a single Fly.io node that may sleep or restart, plus Upstash Redis with request quotas (scaffold design).

## Goals / Non-Goals

**Goals:**
- One in-memory authority per room, with Redis as the durable source of truth.
- Room and session logic testable without sockets or Redis (fake connections, in-memory store).

**Non-Goals:**
- Running more than one server node at a time (the store still detects conflicts; see decision 4).
- Client changes. The current client still speaks hello/ping. Its protocol version check needs both sides updated together, which happens when `client-3d` adopts v2. Until then, a dev client built from this repo uses the same protocol package, so versions match.

## Decisions

### 1. Protocol v2 messages (`packages/protocol`)

Client → server (all inside the existing envelope):

| type | payload | reply |
|---|---|---|
| `hello`, `ping` | unchanged | `welcome`, `pong` |
| `createRoom` | `{ name }` | `roomJoined` + `roomState` |
| `joinRoom` | `{ room, name }` | `roomJoined` + `roomState` |
| `resumeRoom` | `{ room, token }` | `roomJoined` (no token) + `roomState` + `gameSnapshot` if playing |
| `leaveRoom` | `{}` | `roomState` to the others; `roomLeft` to the sender |
| `startGame` | `{ mode, startingPlayer? }` | `roomState` + `gameSnapshot` to every seat |
| `gameAction` | `{ action }` (engine `Action` without `seat`) | `gameUpdate` to every seat, or `actionRejected` to the sender |

Server → client: `welcome`, `pong`, `error { code, message }`, `roomJoined { room, seat, token? }`, `roomLeft`, `roomState { room, status: "lobby" | "playing" | "ended", host, seats: [{ seat, name, connected }] }`, `gameSnapshot { version, view, legal }`, `gameUpdate { version, view (with log: []), events, logLength, legal }`, `actionRejected { code, message }`. Replies set `re` to the request's `seq`.

- `ErrorCode` grows to: `bad_frame`, `version_mismatch`, `internal`, `bad_name`, `room_not_found`, `room_full`, `game_started`, `not_host`, `not_enough_players`, `bad_token`, `no_seat`, `already_in_room`, `unavailable`, `rate_limited`. `actionRejected.code` is the engine's `RuleErrorCode`.
- The action schema is a zod union that mirrors engine `Action` minus `seat` (resource bundles = records of resource → non-negative integer). A compile-time test checks it against the engine type in both directions, so the two cannot drift.
- `view` and `legal` are typed with the engine's `PlayerView` / `LegalActions` and decoded as plain objects (the client trusts the server's shape).
- `PROTOCOL_VERSION` becomes 2. A new close code, `Replaced: 4001`, is added.
- *Alternative*: send the whole view including the log on every update. Rejected because the log grows to roughly 1,000 events in a game, and sending it 4 times per action is wasteful. The client appends `events` and can check `logLength`.

### 2. Server modules

```
apps/server/src/
  store/types.ts    RoomStore interface + stored record types (lead)
  store/memory.ts   in-memory RoomStore (tests, and Redis-less unit runs)
  store/redis.ts    Redis RoomStore (Lua compare-and-set)
  rooms/codes.ts    room codes, names, seat tokens (node:crypto)
  rooms/room.ts     one room: lobby, start, serial action queue, broadcast
  rooms/service.ts  RoomService: registry, load-on-demand, eviction, connection binding
  session.ts        protocol <-> RoomService for one socket, rate limit
  server.ts         routes messages to the session (existing file)
```

`Room` and `RoomService` talk to connections through a tiny `Conn` interface (`send(msg)`, `close(code, reason)`, `id`), so they are unit-tested with fake connections and the memory store. Sessions own the protocol details (seq, `re`).

### 3. Storage layout (Redis)

Keys use the prefix `hexfall:room:<CODE>`:
- `…:meta`: a JSON `RoomMeta` `{ code, rev, status, createdAt, host, seats: [{ name, tokenHash }], config: { seed, mode, playerCount, startingPlayer? } | null }`.
- `…:actions`: a list of JSON actions, with the seat filled in. Index i is the action that took the game from version i to i+1.
- `…:snap`: a JSON `{ version, state }`, written every 25 actions and at game end.

Store operations (`RoomStore`):
- `createMeta(meta)` (fails if the code exists, via `SET NX`)
- `saveMeta(meta, expectedRev)`
- `deleteRoom(code)`
- `loadRoom(code) → { meta, snapshot, actions after snapshot } | null`
- `appendAction(code, expectedVersion, action, snapshot?)`

Every write refreshes a 14-day TTL on all of the room's keys.

### 4. Compare-and-set writes (Lua)

`appendAction` is one Lua script. It checks that `LLEN actions == expectedVersion`, `RPUSH`es the action, optionally `SET`s the snapshot, and refreshes the TTLs. `saveMeta` does the same with `meta.rev`. Each normal action therefore costs one Redis command (`EVALSHA`), which keeps Upstash usage low. A mismatch returns `conflict`. The room is then dropped from memory and reloaded, and the action is refused with `unavailable`. This only happens if two server processes ever touch the same room (for example, an overlapping Fly restart).

### 5. Action pipeline (per room, strictly serial)

1. The request is queued on the room's promise chain.
2. Check the seat binding, then `applyAction(state, {...action, seat})`. A rule error goes to the sender only, and nothing else happens.
3. `await store.appendAction(...)`. If it fails, the in-memory state is not replaced (the engine never mutated it), and the sender gets `unavailable`.
4. Swap in the new state, version + 1.
5. For each connected seat, send `gameUpdate`: `playerView` with the log sliced to the new events, plus `legalActions`.

Lobby changes follow the same order: compute the new meta, `saveMeta`, swap, then broadcast. A store write always comes before any broadcast.

### 6. Load, rebuild and evict

`RoomService` keeps the loaded rooms in a map. On create, join or resume for an unloaded code, it calls `loadRoom`. For a playing room, the state is rebuilt as `snapshot.state ?? createGame(meta.config)`, then every stored action after the snapshot is replayed through `applyAction`. A replay error marks the room as corrupt (`internal`) and is logged. A room with no connections for 10 minutes is evicted from memory (timer, `unref`). `/healthz` reports `rooms: <loaded count>`.

### 7. Codes, names, tokens, seeds

- Room code: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, using `crypto.randomInt`. `createMeta` retries on a collision. Codes are upper-cased on input.
- Seat token: 32 random bytes, base64url. Stored as a SHA-256 hex hash and compared with `timingSafeEqual`.
- Game seed: 16 random bytes, hex string, stored in `meta.config` (the server is trusted, and the seed lets a game be replayed).
- Names: trimmed and NFC-normalized, 1–20 characters, no control characters, unique ignoring case.

### 8. Connections and presence

A connection is bound to at most one (room, seat). A second create, join or resume on a bound connection returns `already_in_room`. Resuming a seat that is held elsewhere closes the old connection with 4001 and rebinds. On socket close, the seat becomes disconnected and `roomState` is broadcast. A lobby player who disconnects keeps their seat (they can resume), and only `leaveRoom` frees a seat. Once the game has started, there is no `leaveRoom` (`game_started`).

### 9. Rate limit

A token bucket per connection: 20 messages per second sustained, with bursts up to 40. When it is empty, the server replies `error rate_limited` and drops the message. Pings count too. The 64 KB `maxPayload` stays.

### 10. Parallel implementation (ownership)

| Owner | Files |
|---|---|
| lead | `packages/protocol/**`, `apps/server/src/store/types.ts`, `rooms/service.ts` and `rooms/room.ts` stubs with signatures, `redis.ts` (expose the client), tasks.md |
| store agent | `store/memory.ts`, `store/redis.ts`, `test/store*.test.ts` |
| rooms agent | `rooms/**` (bodies), `test/rooms*.test.ts` |
| session agent | `session.ts`, `server.ts`, `main.ts`, `test/session*.test.ts`, `test/server.test.ts` |

## Risks / Trade-offs

- [The in-memory authority is lost on a crash between the store write and the broadcast] → The action is already durable. Clients reconnect, resume and get a full snapshot.
- [Upstash quota] → One command per action, plus a snapshot every 25 actions; lobby writes are rare. A full game is roughly 1,000 commands.
- [Lua scripts on Upstash] → Upstash supports `EVAL`/`EVALSHA`. A real-Redis test runs when `REDIS_URL` is set (as in the scaffold).
- [Replay cost after a restart] → At most 24 actions are replayed after a snapshot, which is cheap.
- [Disconnected players stall games forever] → Accepted for the MVP (scaffold decision: no auto-actions). Rooms expire after 14 days.
