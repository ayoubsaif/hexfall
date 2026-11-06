## Context

Hexfall is human-only. `Room.start` rejects fewer than 3 seats, and the only server-side acting for a seat is the system `timeout` action. The engine is a pure state machine: `applyAction(state, action)` and `legalActions(state, seat)` accept any seat, `playerView(state, seat)` hides other hands, and every action is stored in a log that is replayed on recovery. Randomness inside the engine comes only from `state.rng` and its draw order is a replay contract.

## Goals / Non-Goals

**Goals:**
- One person can play a full game alone; small groups can fill seats with bots.
- Bots play legal, sensible, fair moves (decisions from the bot's own view only).
- Bot moves survive restart, pause, and replay with no engine change.

**Non-Goals:**
- Bot trading (proposing or accepting), difficulty levels, bots-only spectating, cheating bots.
- Changing rules or the engine.

## Decisions

1. **Pure package `packages/bots`, not inside the engine.** `chooseAction(view, legal, rng) → ClientAction | null`. Keeps the engine pure (`tools/check-engine.mjs`) and lets the bot be fuzzed alone. Alternative: a function in the server — rejected, untestable without rooms.
2. **Separate RNG for the bot.** Seeded from the room seed and the action count, never `state.rng`, so engine replay is unchanged and bot choices are deterministic in tests.
3. **Fair bot: view + legal only.** `playerView(state, seat)` and `legalActions(state, seat)`. A cheating bot would be unfair and would not exercise the information-hiding path.
4. **Move expansion ported from the fuzz test.** `legalActions` gives categories; concrete bundles (discard, Year of Plenty, Monopoly, maritime) are built by the caller. Port `candidates()` from `packages/engine/test/fuzz.test.ts`, then score candidates by heuristic.
5. **Heuristic order.** Setup: settlement by pip count, resource diversity, harbor; road toward the next best spot. Turn: reveal VP if it wins, city, settlement, dev card, road, maritime only when it completes a build, else end turn. Robber/Knight: move off own hex, target the leader with most cards. Discard: keep what the next build needs. Offers: always reject.
6. **Seat flag, no token.** `StoredSeat.bot?: true`; the token hash is a random value nobody holds, so `lookupSeats` can never match a bot. `SeatInfo.bot` goes to clients; `connected` is always true for bots.
7. **Driver inside `Room`, through the existing queue.** After `start` and after every `commit`, compute bot seats that must act (`waitingSeats(state)` plus bot seats with `rejectTrade` options, since offer responders are not "waited for"). Schedule one move per seat with `deps.setTimer` (about 700 ms; about 150 ms when no human is connected or all seats are bots). On fire, re-read state under `run()`, drop if the version moved, call `chooseAction`, and `commit({...action, seat})`. Alternative: a worker per bot — rejected, it would race the room's serial queue and version checks.
8. **Auto-fill in `start`.** With fewer than 3 seats, append bots until 3, then create the game. Seats are fixed afterwards as today. Lobby may hold up to 4 seats in any human/bot mix; host is always a human at seat 0.
9. **Pause and timers.** Driver checks `frozen()` and does nothing while paused or ended; resume and `fromLoaded` re-run the driver. The turn timer is not armed for waits that only bots are on; bots do not need the `timeout` fallback, and a bot that fails to produce a move falls back to the `timeout` path through its normal timer if one is armed, otherwise to a random legal move.
10. **Names.** Fixed pool of bot names that pass `validateName`; skipped if a human took the name (case-insensitive).

## Risks / Trade-offs

- **Bot stalls or returns no move** → driver falls back to a random legal move from `legalActions`; fuzz tests assert no stall.
- **Idle eviction of bot-only waits** → rooms with no human connection are still evicted after the idle time; `fromLoaded` re-arms the driver on next use.
- **Double act with the turn timer** → both commit through the same queue and the version guard drops the loser.
- **Bot strength is modest** → acceptable for v1; the package boundary allows later improvement and trading.
- **Spec conflict on Presence** → modified in this change with an explicit bot exception.
