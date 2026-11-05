## Why

A game of Hexfall takes over an hour, and groups often have to stop before it ends. Today the room quietly stays in Redis, but nothing marks it as stopped: with a turn timer on, the server keeps playing for absent players until the game is ruined, and players have no way to find the room again except an old invite link. The host needs a deliberate "close for now" that freezes the game, and every player needs an easy way back to it. Sometimes the group knows it will not come back at all; then the host needs to end the game now and see who was ahead, instead of leaving a dead room behind.

## What Changes

- **Pause ("Close game for now")**: the host can pause a running game from the HUD (with a confirmation). The room becomes `paused`: no game action is accepted (`game_paused`), the turn timer freezes with its remaining time kept, no turn alerts are sent, and every player sees a "Paused by the host — saved for 7 days" screen. Players may close their tabs.
- **Resume**: only the host can resume. The game continues exactly where it stopped, and the frozen countdown continues from its remaining time. Other players can reconnect to a paused room and look at the board while they wait.
- **Retention**: a paused room expires 7 days after it was paused (any room write refreshes the normal 14-day expiry, so resuming restores it).
- **Saved games list**: the start screen lists the rooms this browser holds a seat in (from stored seat tokens), with status (waiting in lobby / playing / paused), player names, turn number and, for paused rooms, when they expire. "Continue" resumes the seat. Rooms that no longer exist, have ended, or reject the token are dropped from the list and from storage.
- **End game now**: the host can end a running or paused game early (with a confirmation). The server totals each player's VP (public VP plus hidden VP cards) and the player with the most VP wins; players tied for the most share the win. The room becomes `ended`, every player sees the final scoreboard marked "Ended by the host" with all VP revealed, and the room is kept for 1 day so players can look at the result, then expires.
- **Protocol**: new client messages `pauseGame`, `resumeGame`, `endGame`, `lookupSeats`; new server message `seatsInfo`; room status gains `paused`; `roomState` gains `pausedAt` and `result` (early-end outcome); error codes gain `game_paused`, `not_paused` and `not_playing`. **BREAKING** for wire compatibility: `PROTOCOL_VERSION` goes up by one (deploy server and client together; fold into the same bump as `turn-sound-and-push` if both ship together).
- **Engine**: no rule change. Pause and early end are room-level states, never game rules; the early-end result is computed with the engine's existing `publicVp` / `hiddenVp` helpers.

## Capabilities

### New Capabilities
- `game-pause`: host-only pause and resume of a running game, what is blocked while paused, timer freeze and restore, what players see, and paused-room expiry.
- `early-end`: host-only early end of a game, how the winner is chosen (most total VP, ties shared), the final scoreboard, and ended-room retention.
- `saved-games`: client list of rooms held in this browser, the server lookup that reports their status, and continue/forget behavior.

### Modified Capabilities
- `game-server`: "Persistence and recovery" changes the expiry rule (paused rooms expire 7 days after pausing, early-ended rooms 1 day after ending) and requires pause state and the frozen countdown to survive restarts.

## Impact

- **Server** (`apps/server`): `RoomMeta` gains `status: "paused"`, `pausedAt` and the remaining-time record; `Room.pause()` / `Room.resume()` / `Room.end()` through the room queue; `RoomMeta.result` for early end; timer disarm/re-anchor; `act` and timeouts refused while paused; store gains a per-write TTL and a cheap `loadMeta` (meta + remaining TTL) for lookups; `RoomService.lookupSeats`.
- **Protocol** (`packages/protocol`): new messages and codes, `RoomStatus` adds `paused`, version bump.
- **Client** (`apps/client`): host pause and end controls with confirm dialogs, game-over dialog driven by the early-end result (shared winners, "Ended by the host"), paused overlay with Resume for the host, i18n (en/es), start-screen "Saved games" list using `seatStorage`, session handling of `seatsInfo` and of the paused status.
- **Interplay**: `turn-sound-and-push` (not yet archived) must not push while paused; on resume, seats the game waits for are alerted like a turn start.
- **Rules engine**: untouched.
