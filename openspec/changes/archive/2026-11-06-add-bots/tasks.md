## 1. Bots package

- [x] 1.1 Create `packages/bots` (`@hexfall/bots`) with package.json, tsconfig, workspace wiring; check `tools/check-engine.mjs` rules
- [x] 1.2 Port move expansion from `packages/engine/test/fuzz.test.ts` `candidates()` (discard, Year of Plenty, Monopoly, maritime bundles)
- [x] 1.3 Implement `chooseAction(view, legal, rng)` with seeded bot RNG and random-legal fallback
- [x] 1.4 Setup heuristics: settlement scoring (pips, diversity, harbor) and road direction
- [x] 1.5 Turn heuristics: reveal winning VP, city, settlement, dev card, road, useful maritime, end turn
- [x] 1.6 Robber, Knight, discard and Road Building heuristics; always reject offers, never propose
- [x] 1.7 Unit tests per heuristic
- [x] 1.8 Fuzz test: 20 seeded full games with 3 and 4 bots; no rejected action, invariants hold, a winner

## 2. Protocol and store

- [x] 2.1 Add `addBot`/`removeBot` messages and `SeatInfo.bot` in `packages/protocol/src/messages.ts`; error codes `not_a_bot`
- [x] 2.2 Bump `PROTOCOL_VERSION` if repo convention requires; update codec/messages tests
- [x] 2.3 Add `StoredSeat.bot` in `apps/server/src/store/types.ts`; check memory and Redis stores and the store contract

## 3. Server rooms

- [x] 3.1 Bot name pool and unique-name selection (`rooms/codes.ts`)
- [x] 3.2 `Room.addBot`/`removeBot` (host only, lobby only, cap 4, close up seats); delete room when last human leaves
- [x] 3.3 Auto-fill bots to 3 in `Room.start`; remove `not_enough_players` path for the host
- [x] 3.4 Report `bot: true` and `connected: true` in room state; keep bots out of `lookupSeats`
- [x] 3.5 Bot driver: compute bot seats to act (`waitingSeats` plus pending offers), schedule via `deps.setTimer`, re-check version on fire, commit with the seat
- [x] 3.6 Driver skips when paused or ended; re-run on resume, `fromLoaded` and after commit
- [x] 3.7 Do not arm the turn timer for bot-only waits; engine `timeout` fallback if the bot has no usable move and only bots are awaited
- [x] 3.8 Server tests with fake scheduler: 1 human fills 2 bots, setup, discard, robber, offer rejection, pause, reload, replay equals live state

## 4. Client

- [x] 4.1 Carry `bot` through `roomState` (`store/room.ts`, `net/session.ts`); add `addBot`/`removeBot` to `SessionApi` (`net/actions.ts`)
- [x] 4.2 Lobby: Add bot / Remove controls, bot badge, never offline, enable Start for host alone with fill note
- [x] 4.3 Start screen: "Play solo vs bots" with 2 or 3 opponents
- [x] 4.4 Bots never shown disconnected (server reports connected); saved-games list marks bots. Bot icon in player panels left out for now
- [x] 4.5 English and Spanish strings (parity test passes)
- [x] 4.6 Client tests: lobby controls, solo button, bot badge

## 5. Verify

- [x] 5.1 `pnpm check` and `vp test run` pass
- [x] 5.2 Manual: Play solo, play several turns, reload mid-game, pause and resume (done in a browser against a separate server; see notes)
