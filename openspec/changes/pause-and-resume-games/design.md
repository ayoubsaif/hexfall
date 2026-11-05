## Context

- Rooms already persist in Redis (meta + action log + snapshots, 14-day TTL refreshed on every write) and seats resume by token, so a game survives everyone leaving. What is missing is an explicit stopped state: with a turn timer on, `Room.arm()` keeps scheduling deadlines and the server plays timeouts for absent players.
- `RoomMeta.status` is `lobby | playing | ended`; `Room.status()` derives `ended` from the game phase. Every room operation runs through `Room.run()` (one at a time, persist then broadcast).
- The timer deadline is never stored: it is `anchor + duration(wait)`. The anchor is rebuilt from `meta.startedAt` / snapshot anchor and the `at` times of replayed actions (`nextAnchor`).
- Client keeps seat tokens per room in `localStorage` (`net/seatStorage.ts`, `hexfall.seats`) plus the last room; the start screen only offers create/join and auto-resumes the last room.
- `turn-sound-and-push` (implemented, not archived) adds a push notifier hooked into `RoomDeps.waitsChanged` and bumps the protocol to 4.

## Goals / Non-Goals

**Goals:**
- Host-only pause/resume that freezes everything and survives restarts.
- The countdown continues with exactly the time that was left.
- Players can find and continue their games from the start screen.
- Paused rooms are cleaned up 7 days after pausing.
- The host can end a game early; the player with the most total VP wins (ties shared); the result is kept 1 day.

**Non-Goals:**
- Host transfer or voting when the host never comes back (the room just expires).
- Pausing from the lobby or after the game ended.
- Server-side accounts or cross-device game lists (the list is per browser, from stored tokens).
- Undo, save slots or exporting a game.
- Voting to end, or ending by a non-host. Recording early-ended results in any stats or history.

## Decisions

### 1. `paused` is a stored room status, not a game phase
`RoomMeta.status` gains `"paused"`, plus `pausedAt?: number` and `pauses?: { at: number; ms: number }[]` (completed pauses). The engine and `GameState` are untouched (AGENTS.md: rules engine is a pure state machine; pausing is not a rule).
- `Room.status()` returns `paused` when `meta.status === "paused"`; `RoomStatus` in the protocol adds `paused`.
- `Room.act()` and `Room.fire()` check status first: `act` → `{ error: game_paused }`; `fire` returns without committing. `arm()` does nothing while paused; `pause()` calls `disarm()`.
- `timer()` returns null while paused, so snapshots carry no countdown.
- *Alternative*: an engine `pause` action. Rejected: it would enter the replay log and rules, and AGENTS.md forbids non-rule state in the engine.

### 2. Freezing the countdown by shifting the anchor
At pause, store `pausedAt`. At resume (`now`), append `{ at: pausedAt, ms: now - pausedAt }` to `meta.pauses`, clear `pausedAt`, and set the in-memory `anchor += ms`. On rebuild after a restart, after replaying actions, add the `ms` of every pause whose `at` is at or after the rebuilt anchor (pauses that began while that anchor was in force). Actions after the resume carry later `at` values and restart the anchor normally, so older pauses stop mattering. `pauses` is capped to the last 50 entries.
- Why: the deadline stays derived (`anchor + duration`) as in the turn-timer design, and no action has to be invented to store a new anchor.
- *Alternative*: store `remainingMs` and a fresh anchor on resume. Rejected: rebuild only derives anchors from actions/snapshots; a meta-level anchor override would need to know which actions came after it — the pause list answers that by time.

### 3. Pause and resume go through the room queue
`Room.pause(req)` / `Room.resume(req)` use `run()`: check seat is host (`not_host`), check status (`not_playing` / `not_paused`), `saveMeta` (rev + 1), then broadcast `roomState`; resume also sends a `gameSnapshot` to every connected seat (new countdown) and calls `arm()`. A pause racing a player's action is serialized by the queue: whichever arrives first wins.
- Resume calls `deps.waitsChanged(room, null, state)` so the push notifier from `turn-sound-and-push` alerts seats the game waits for (if not visible). Pausing calls nothing; the notifier is never reached while paused because no commit happens.

### 4. Expiry per write
`RoomStore.saveMeta(meta, rev, ttlMs?)` takes an optional TTL; the Redis script already `PEXPIRE`s meta, actions and snapshot with the TTL argument. Pause writes with `PAUSED_TTL_MS = 7 days`; resume and every other write use `ROOM_TTL_MS` (14 days). Push subscriptions (`push:{ROOM}`) get the same TTL on pause via the push store (`touch(room, ttl)`), when that store is present. Lookups never write, so they never extend a paused room.

### 5. `lookupSeats` reads metadata only
New store method `loadMeta(code): Promise<{ meta: RoomMeta; ttlMs: number } | null>` (Redis: `GET meta` + `PTTL` in one pipeline; memory: entry + `ttl()`). The turn number is taken from the in-memory room when it is loaded, and otherwise omitted (the UI then shows "In progress" without a number). Storing it in `RoomMeta` was rejected: it would add a meta write to every action. Status `ended` comes from `meta.status` (already saved on game end).
- Token check uses the existing constant-time `tokenMatches` against every seat hash; no match or no room → `{ room, status: "gone" }`.
- The service handles it without `claim()`/`bind()`: no seat, no presence change. Limit 20 entries in the protocol schema; normal per-connection rate limits apply.
- *Alternative*: load full rooms to report the turn. Rejected: replaying 20 games for a menu is wasteful.

### 6. Client
- **Session**: `SessionController` gets `pauseGame()`, `resumeGame()`, `lookupSeats()`; handles `seatsInfo` into a new `store/savedGames.ts` (`entries`, `loading`); forgets `gone`/`ended` rooms through `seatStorage.forget`. `seatStorage` gains `list(): { room, token, usedAt }[]` and records `usedAt` on save/setLastRoom (stored alongside the token; old string values read as `usedAt: 0`).
- **Paused overlay** `hud/PausedNotice.tsx`: shown when `useRoomStore.status === "paused"`, above the board and below dialogs' z-order; disables game controls by having the session store `legal: null` and `timer: null` while the room is paused or ended early (on the room state and on every snapshot/update), so every control, alert and 3D target reads one place (the server would refuse the actions anyway). Host sees "Resume game". Expiry date = `pausedAt + 7 days`, formatted with `Intl.DateTimeFormat` in the current language. `roomState` gains `pausedAt` (null unless paused) so every player can show the date.
- **Host control**: a host-only "Game" button in the HUD corner next to settings (the HUD has no other menu) opens "Close game for now" and "End game now", each with a confirm `Dialog` (`hud/GamePause.tsx`).
- **Start screen**: `SavedGames` section above create/join; sends `lookupSeats` on mount and on reconnect while shown; auto-resume of the last room stays as today (a paused last room resumes into the paused notice).
- **TurnFocus / alerts**: `useRollWait` and `useGameAlerts` treat a paused room as no wait, so no overlay or chime while paused; on resume the snapshot does not chime (snapshots never do), the push covers absent players.

### 7. Protocol
- Client → server: `pauseGame {}`, `resumeGame {}`, `endGame {}`, `lookupSeats { seats: { room, token }[] ≤ 20 }`.
- Server → client: `seatsInfo { rooms: SeatInfoEntry[] }`; `roomState` adds `pausedAt: number | null` and `result: EarlyResult | null`; `RoomStatus` adds `paused`; `ErrorCode` adds `game_paused`, `not_paused`, `not_playing`.
- `PROTOCOL_VERSION` + 1 (5 after `turn-sound-and-push`'s 4; a single bump if both ship in one deploy).

### 8. Early end is a room result, not a game rule
`Room.end(req)` goes through `run()`: host check (`not_host`), status must be `playing` or `paused` (`not_playing`), compute the result, `disarm()`, `saveMeta` with `status: "ended"`, `result` and `ENDED_EARLY_TTL_MS = 1 day` (clearing `pausedAt`), then broadcast `roomState`.
- `RoomMeta.result?: { reason: "host"; at: number; winners: Seat[]; scores: { seat: Seat; vp: number; hiddenVp: number }[] }`. Scores use the engine's exported `publicVp(s, i) + hiddenVp(s, i)`; winners = every seat with the max total.
- The engine state is untouched: `phase` stays where it was, `winner` stays null. `Room.status()` returns `ended` when `meta.status === "ended"` (already persisted for natural ends, now also the early-end source of truth). `act()` checks `meta.result` and refuses with `game_over` (an existing rule error code, so the client already maps it); `fire()` and `arm()` do nothing; `timer()` is null.
- Push notifier: no call on early end (nothing waits any more). Push subscriptions get the 1-day TTL through `touch(room, ttl)` when the store is present.
- Rebuild after restart: replay as today, then `meta.result` makes the room ended; no anchor work needed.
- *Alternative*: an engine `concede`/`endGame` action that sets `phase: ended` and `winner`. Rejected: AGENTS.md forbids non-rule state in the engine, `winner` is a single seat while ties must be shared, and it would enter the replay log.
- *Alternative*: no winner, just close. Rejected: the user asked for the leader to win.

### 9. Client for early end
- `roomState` gains `result: EarlyResult | null`; `useRoomStore` keeps it.
- Host "Game" button: "End game now" beside "Close game for now"; `PausedNotice` gets a host "End game" button. Both open one shared confirm (`EndGameConfirm` in `hud/GamePause.tsx`) that sends `endGame()`.
- `GameOver` in `hud/Feed.tsx` shows when `view.winner !== null` **or** `room.result` is set. For a result it reads names, VP and hidden VP from `result.scores` (the view still hides hands; the result is what reveals totals), titles "Ended by the host — {names} win(s)", bolds every winner.
- The session keeps `legal` null when `room.result` is set, so all controls disable and `useGameAlerts` sees no wait.

### 10. Telling saved games apart; ending from the list
Players can hold seats in several rooms with the same names (an abandoned game and a new one). `loadMeta` also reads the last action record (`LINDEX actions -1`, same pipeline) so `seatsInfo` can give `createdAt`, `startedAt` and `lastActiveAt`; the list shows "Started … · last move …". Stale games can be ended by their host from the list with `endSavedGame { room, token }`: the token proves the host seat (constant-time match, as for resume) and `Room.endWithToken` runs the same `endNow` as `endGame`, without binding the connection. The reply is a one-room `seatsInfo`, which the client merges into its list (an ended room drops out and its token is forgotten).

## Risks / Trade-offs

- [Host never returns: the other players cannot continue] → accepted for now (non-goal); the room expires after 7 days. A later change can add host transfer.
- [Turn number missing for unloaded rooms in the list] → the list shows status and names, which is enough to recognize a game; avoids replay cost.
- [Clock skew between pause and resume across a restart] → only server time is used (`deps.now()`), as for the turn timer.
- [`pauses` list growth] → capped at 50; older pauses can only affect an anchor older than 50 pauses, which a timer-on game never keeps.
- [Saved-games list reveals rooms only to token holders] → wrong tokens and missing rooms answer identically (`gone`).
- [Early end in setup gives everyone 0–2 VP and a shared win] → accepted; the confirm text explains the rule, and ending that early is rare.
- [Players cannot see opponents' final hands after an early end, only VP totals] → accepted; revealing hands would need an engine view change for a non-rule state.
- [Host ends a game others wanted to finish] → the confirm dialog warns it cannot be undone; non-goal to add voting.
- [Protocol bump] → deploy server and client together, as documented.

## Migration Plan

1. Stored rooms without `pausedAt`/`pauses`/`result` read as never paused and not ended early; no data migration.
2. Old seat-storage values (plain token strings) read with `usedAt: 0`.
3. Deploy server and client together. Rollback: an old server reading a `paused` meta would treat it as unknown status — before rolling back, resume or let paused rooms expire, or accept that they become unreadable (they are refused as `internal` and expire).

## Open Questions

- Should "Remove" in the saved list also leave a lobby seat on the server? (Current answer: no, local only.)
