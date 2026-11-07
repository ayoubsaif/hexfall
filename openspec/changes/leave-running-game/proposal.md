## Why

Once a game has started, nobody can leave it. Only the host has a way out (pause or end the game for everyone); every other player is stuck holding a seat they can only abandon by closing the tab, which stalls the game whenever it waits on them. Players need to be able to leave a running game without ending it for the others, and the table needs a way to fill the gap.

## What Changes

- Every seated human (host or not) can **leave a running game** (`playing` or `paused`) with the existing `leaveRoom` message, after a confirmation in the HUD. Today this fails with `game_started`.
- The leaver's seat is **not removed**: it stays in the game with all its pieces, cards, development cards and VP, becomes an **open seat**, and a **bot plays it** from that moment so the game never stalls.
- The leaver's seat token stops working: they cannot resume that seat, and it disappears from their saved games.
- Anyone with the room code (or invite link) can **take over an open seat** with `joinRoom` while the game is `playing` or `paused`. They get a new seat token, their own name and avatar, and the seat's full game state. With no open seat, joining a started game still fails with `game_started`.
- If the host leaves, the first remaining human seat becomes host. If the last human leaves, the room is deleted.
- Room state marks open seats, so the HUD can show "Open seat" on that player's panel and players can share the invite link to fill it.
- The HUD game menu becomes available to **every** player during a game: non-hosts see "Leave game" (plus the invite link); the host sees "Leave game" next to the existing "Close game for now" and "End game now". The menu button gets a new painted gold **leave icon** instead of the pause icon (pause stays on "Close game for now" only).
- Lobby behaviour is unchanged: leaving the lobby still closes up seats.
- No rules-engine changes: a taken-over seat is the same player in the game; only who sends its actions changes.

## Capabilities

### New Capabilities
- `leave-game`: leaving a running game, the bot takeover of the left seat, taking over an open seat by joining, and the HUD controls and indicators for both.

### Modified Capabilities
- `game-server`: "Joining and leaving the lobby" changes so joining after the start is allowed when an open seat exists; "Starting a game" changes from "seats fixed for the room's life" to "seat count and order fixed; who holds a seat can change only through leaving and taking over".

## Impact

- **Protocol** (`packages/protocol`): `SeatInfo` in `roomState` gains an `open` flag; `roomJoined` may arrive for a started room (followed by `gameSnapshot`); leave/join cases reuse existing error codes (`game_started`, `not_playing`).
- **Server** (`apps/server/src/rooms/room.ts`, `service.ts`): `leave()` handles `playing`/`paused`; `join()` claims an open seat in a started room; room meta seats gain an `open` marker; bot scheduling must pick up a newly-botted seat at once and stop for a seat a human just took over; push unsubscribe via `seatLeft`.
- **Client** (`apps/client/src/hud`, `net/session.ts`, i18n en/es): game menu for all players with a "Leave game" confirm; "Open seat" badge on player panels; joining a started room lands in the game view; leaver returns to the start screen.
- **Tests**: server room/service tests for leave, takeover, host transfer, last-human delete, restart recovery; client HUD tests for the menu and badge.
- No engine, rules or persistence-format breaking change; existing stored rooms load unchanged (missing `open` = not open).
