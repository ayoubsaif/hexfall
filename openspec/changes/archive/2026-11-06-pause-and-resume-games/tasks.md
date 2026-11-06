## 1. Protocol

- [x] 1.1 Add `pauseGame`, `resumeGame`, `endGame`, `lookupSeats` (≤ 20 `{ room, token }`) client messages and the `seatsInfo` server message with its entry schema (`gone` variant included)
- [x] 1.2 `RoomStatus` adds `paused`; `roomState` adds `pausedAt: number | null` and `result: EarlyResult | null` (reason, at, winners, scores with vp/hiddenVp); `ErrorCode` adds `game_paused`, `not_paused`, `not_playing`
- [x] 1.3 Bump `PROTOCOL_VERSION`; update protocol tests (accept/reject cases for the new messages)

## 2. Store

- [x] 2.1 `RoomMeta`: `status` adds `paused`; add `pausedAt?`, `pauses?: { at, ms }[]` and `result?`
- [x] 2.2 `saveMeta(meta, rev, ttlMs?)` in the interface, memory and Redis stores; add `PAUSED_TTL_MS` (7 days) and `ENDED_EARLY_TTL_MS` (1 day)
- [x] 2.3 `loadMeta(code)` returning meta + remaining TTL (memory and Redis), without refreshing expiry
- [x] 2.4 Store contract tests for per-write TTL and `loadMeta` (memory always, Redis opt-in)

## 3. Room pause / resume

- [x] 3.1 `Room.status()` reports `paused`; `timer()` null while paused; `arm()` no-op while paused
- [x] 3.2 `Room.pause(req)`: host check, `not_playing`, save with `PAUSED_TTL_MS` and `pausedAt`, disarm, broadcast room state
- [x] 3.3 `Room.resume(req)`: host check, `not_paused`, record the pause in `pauses` (cap 50), shift the in-memory anchor, save with normal TTL, broadcast room state and snapshots, `arm()`, call `deps.waitsChanged(room, null, state)`
- [x] 3.4 `act()` refuses with `game_paused`; `fire()` drops timeouts while paused
- [x] 3.5 Rebuild: restore paused status, and add the `ms` of pauses that began at or after the rebuilt anchor
- [x] 3.6 Push store (if present): set the paused TTL on pause
- [x] 3.7 Service + session routing for `pauseGame` / `resumeGame`; `roomState.pausedAt`
- [x] 3.8 Tests: pause mid-turn, non-host refusals, action while paused, timer frozen for hours, resume with the remaining time, resume alone, restart while paused keeps status and remaining time, pause/action race order, store failure keeps `playing`, paused TTL set and restored, no push while paused and push on resume

## 4. Early end (server)

- [x] 4.1 Pure `earlyResult(state, at)` helper: totals from `publicVp + hiddenVp`, all seats tied at the max are winners; unit tests (clear leader, hidden VP decides, tie shared, setup phase)
- [x] 4.2 `Room.end(req)`: host check, `not_playing` unless `playing`/`paused`, disarm, save `status: "ended"` + `result` (clear `pausedAt`) with `ENDED_EARLY_TTL_MS`, broadcast room state; push store TTL to 1 day if present
- [x] 4.3 `act()` refuses with `game_over` and `fire()`/`arm()` do nothing when `meta.result` is set; rebuild keeps the result
- [x] 4.4 Service + session routing for `endGame`; `roomState.result`
- [x] 4.5 Tests: end mid-turn, end while paused, non-host refused, end after natural end refused, action after end refused, store failure keeps previous status, restart keeps result, TTL set to 1 day, no push after end

## 5. Seat lookup

- [x] 5.1 `RoomService.lookupSeats`: `loadMeta` per entry, constant-time token match, `gone` for missing/mismatch, turn number from loaded rooms, expiry from TTL; no bind, no presence change
- [x] 5.2 Session routing and `seatsInfo` reply; `bad_frame` over 20 entries
- [x] 5.3 Tests: mixed valid/gone/ended, wrong token indistinguishable from missing, no side effects on a held seat, no TTL refresh

## 6. Client: pause and end

- [x] 6.1 Session: `pauseGame()`, `resumeGame()`; room store keeps `pausedAt`; error toasts for the new codes (en/es)
- [x] 6.2 `useLegal()` returns null while paused; `useRollWait` / `useGameAlerts` see no wait while paused
- [x] 6.3 Host-only "Close game for now" control with a confirm dialog (en/es)
- [x] 6.4 Host-only "End game now" in the HUD menu and "End game" on the paused notice, shared `EndGameDialog` confirm (winner rule, cannot be undone) sending `endGame` once (en/es)
- [x] 6.5 `PausedNotice`: full-screen notice, localized expiry date, host "Resume game", screen-reader announcement (en/es)
- [x] 6.6 Early-end scoreboard: `GameOver` shows for `room.result`, "Ended by the host", one or several winners, VP + hidden VP from `result.scores`, winners bold; `useLegal()` null and no waits when `result` set (en/es)
- [x] 6.7 Tests: control visible only to the host, confirm sends `pauseGame` once, notice for host and non-host, controls disabled while paused, notice closes on `playing`; end control host-only, cancel sends nothing, confirm sends `endGame` once, scoreboard with shared winners, notice closes on result

## 7. Client: saved games

- [x] 7.1 `seatStorage`: store `usedAt` with each token (read old string values as `usedAt: 0`), add `list()`
- [x] 7.2 Session: `lookupSeats()`; handle `seatsInfo` into `store/savedGames.ts`; forget `gone` / `ended` rooms
- [x] 7.3 `SavedGames` section on the start screen: lookup on show and on reconnect, loading state, ordering, status/names/turn/expiry, Continue (resume) and Remove (forget) (en/es)
- [x] 7.4 Tests: storage migration, list rendering and ordering, gone rooms dropped from storage, Continue resumes with the stored token, Remove forgets locally only

## 8. Docs and verification

- [x] 8.1 README: pausing, 7-day retention, ending early (winner rule, 1-day retention), saved games list, protocol bump note
- [x] 8.2 `pnpm test` passes; lint and check scripts pass for the changed files
- [x] 8.3 Manual check: host pauses with a timer running, everyone closes tabs, server restarts, a player continues from the saved list and sees the paused notice, host resumes and the countdown continues from the time left; then host ends the game early and every player sees the scoreboard with the leader (or tied leaders) as winner

## 9. Follow-up: telling saved games apart, ending from the list

- [x] 9.1 Store `loadMeta` also returns the last stored action time (memory and Redis, one pipeline)
- [x] 9.2 `seatsInfo` entries add `createdAt`, `startedAt`, `lastActiveAt` (last move, pause, resume, early end or start)
- [x] 9.3 `endSavedGame { room, token }`: host proven by token, no seat taken, same end path as `endGame`, answered with that room's `seatsInfo`
- [x] 9.4 Saved games list: "Started … · last move …" (or "Created …" for a lobby), host-only "End game" with the shared confirmation and error (en/es)
- [x] 9.5 Tests: lookup times, end from list (host, non-host, wrong token, unloaded room, ended), store `lastActionAt`, client merge/error handling, list rendering

