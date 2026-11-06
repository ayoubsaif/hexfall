## Why

Hexfall needs 3–4 humans to start a game, so a lone player (or a pair) cannot play at all. Server-side bots let one person play solo and let small groups fill empty seats.

## What Changes

- New pure package `@hexfall/bots`: a heuristic, fair (view-only) bot that picks one legal action per call. No trading: it rejects every offer and never proposes one.
- Seats gain a `bot` flag. Bot seats are always shown connected and have no usable seat token.
- Host can add and remove bots in the lobby (`addBot`, `removeBot`), up to 4 seats total.
- Starting with fewer than 3 seats auto-fills bots up to 3 instead of failing with `not_enough_players`.
- Start screen gets "Play solo vs bots": creates a room, adds bots and starts.
- Room runs a bot driver: after start and after every commit it schedules moves for bot seats the game is waiting on, with a short human-readable delay. Bot actions are stored and replayed like any other action.
- **BREAKING (spec):** the Presence rule "server SHALL NOT take any action on a player's behalf" gains an exception for bot seats.
- Lobby shows bot badges; bots never show as offline. Strings in English and Spanish.

## Capabilities

### New Capabilities
- `bots`: bot seats, their play behaviour (fair, heuristic, no trading), the driver timing, and the solo/auto-fill entry points.

### Modified Capabilities
- `game-server`: joining/leaving (bot seats, host-only add/remove), starting (auto-fill to 3, host with 1 human), presence (server acts for bot seats).
- `game-pause`: no bot moves are made while paused; they resume with the game.

Saved-games marking and the English/Spanish strings are covered as requirements of `bots`.

## Impact

- New: `packages/bots`.
- `packages/protocol/src/messages.ts`: `addBot`, `removeBot`, `SeatInfo.bot`; protocol version bump if the repo convention requires it.
- `apps/server/src/rooms/{room,service,timer,codes}.ts`, `apps/server/src/store/types.ts` (`StoredSeat.bot`).
- `apps/client/src/hud/{StartScreen,Lobby,names}`, `net/{actions,session}`, `store/room.ts`, `i18n/locales/{en,es}`.
- No engine change: bot actions use the existing `applyAction` and the replay log.
- Out of scope: bot trading, difficulty levels, bots-only spectating, cheating bots.
