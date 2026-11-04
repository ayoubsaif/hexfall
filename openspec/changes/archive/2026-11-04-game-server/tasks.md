## 1. Shared contracts (lead)

- [x] 1.1 Add the protocol v2 messages, error codes, the `Replaced` close code and the engine action schema (design decision 1) to `packages/protocol`, and set `PROTOCOL_VERSION` to 2. Verify with codec tests for every new message (round-trip, a bad payload fails as `bad_frame`), and a compile-time test that the action schema and engine `Action` minus `seat` match in both directions.
- [x] 1.2 Add `apps/server/src/store/types.ts` (`RoomStore`, `RoomMeta`, the stored records and results), the `Conn` interface, and stub `rooms/room.ts` / `rooms/service.ts` with their exported signatures. Expose the raw ioredis client from `redis.ts` for the store. Verify that `pnpm run check` passes.

## 2. Storage (store agent)

- [x] 2.1 Implement `store/memory.ts` with the exact `RoomStore` semantics: create-if-absent, compare-and-set on `rev` and on the action count, snapshots, delete, and a fake clock for TTLs. Verify with `test/store.test.ts`, written as a shared contract suite that runs against the memory store.
- [x] 2.2 Implement `store/redis.ts` using the Lua compare-and-set scripts, the key layout and 14-day TTL refresh from design decisions 3–4, and `EVALSHA` with an `EVAL` fallback. Verify that the same contract suite passes against real Redis when `REDIS_URL` is set (skipped otherwise), including a conflict on a stale version and TTLs set on every key.

## 3. Rooms (rooms agent)

- [x] 3.1 Implement `rooms/codes.ts`: room codes, name validation and normalization, seat tokens with SHA-256 hashes, and seeds. Verify with unit tests: the alphabet and length, case-insensitive parsing, the name rules (trim, 1–20, control characters, case-insensitive duplicates), a token hash round-trip, and that a wrong token fails.
- [x] 3.2 Implement `rooms/room.ts`: lobby join/leave with seats closing up in join order and host hand-over, start (host only, 3–4 players, mode and starting seat), the serial action queue with the seat injected, store-before-broadcast, refusal and no state change when the store fails, per-seat `gameUpdate` (view with an empty log, new redacted events, `logLength`, legal moves) and presence. Verify with `test/rooms.test.ts` using fake connections and the memory store, covering every lobby and start error code, action rejection only to the sender, steal redaction per seat, a store failure giving `unavailable`, and a disconnect during a discard keeping the phase.
- [x] 3.3 Implement `rooms/service.ts`: create/join/resume/leave/start/act/disconnect routing, connection binding (`already_in_room`, `no_seat`), resume with `bad_token` that never reveals whether a room exists, replacing an older connection (4001), load-on-demand with rebuild from snapshot plus actions, conflict handling, idle eviction and the loaded-room count. Verify with `test/service.test.ts`: a rebuild after 40 actions (snapshot at 25) equals the live state, a resume after eviction works, the replaced connection is closed, and a conflict reloads the room.

## 4. Sessions and wiring (session agent)

- [x] 4.1 Implement `session.ts`: decode messages, map them to `RoomService` calls, set `re`, and apply the token-bucket rate limit (20/s, burst 40). Wire it into `server.ts` and `main.ts` with the Redis store, and add `rooms` to `/healthz`. Verify with `test/session.test.ts` (a flood is answered with `rate_limited`, a malformed action gives `bad_frame`, replies carry `re`) and the updated `test/server.test.ts`.

## 5. Integration (lead)

- [x] 5.1 Write `test/e2e.test.ts` with 3 real ws clients against `createServer` and the memory store: create, join, start, then play through setup and 3 full turns by choosing moves from each client's own `legal`. Assert that no client ever sees another hand, that every update's version goes up by exactly 1, and that the final views agree on public state.
- [x] 5.2 Write a restart test: run the game partway on server A, close it, start server B on the same store, resume all clients, and check that the views are identical and play continues. Also run it against real Redis when `REDIS_URL` is set. Then run it once by hand against Docker Redis with `pnpm run dev` and two Node clients.
- [x] 5.3 Run `pnpm run check`, `pnpm run test`, `pnpm run build` and `node tools/check-engine.mjs`, and verify that all pass. Update `CHECKPOINT.md` with the game-server status and the protocol v2 note for `client-3d`.
