## Why

The engine and the authoritative server can run a full multiplayer game, but nobody can play it: the client only speaks hello/ping and shows a preview board. This change turns the client into a playable game. Players can make or join a room, take a seat, see the live board with everyone's pieces, pick legal moves on the board, and follow the game in a HUD.

## What Changes

- **Protocol v2 in the client.** The connection sends the room and game messages and handles `roomJoined`, `roomLeft`, `roomState`, `gameSnapshot`, `gameUpdate`, `actionRejected` and `error`. Close code 4001 (Replaced) stops reconnecting and tells the player that the seat is open in another tab.
- **Lobby.** A start screen to create a room or join one with a code and a display name. An invite link carries the room code. The lobby lists seats with presence. The host picks the board mode (beginner or variable) and, optionally, a starting player, then starts. Players can leave while in the lobby.
- **Seat resume.** The seat token is saved in the browser per room. After a reload, a network drop or a server restart, the client resumes the seat on its own and gets the full view back.
- **Game store.** It holds the latest redacted view, legal moves, state version and the redacted log. It is written only from server messages: nothing is applied optimistically, and the client never decides legality.
- **Live board.** Roads, settlements and cities in seat colors, the robber on its current hex, and the real board from the game (it replaces the preview once a game arrives). This works in both Flat and 3D styles.
- **Legal-move picking.** Only the legal targets the server sent are highlighted and clickable: intersections for settlements, paths for roads (setup, paid, and Road Building), own settlements for cities, and hexes for the robber. Choosing a target sends one game action. When several victims can be robbed, the player picks one.
- **HUD.** Player panels (name, presence, color, card counts, played Knights, public VP, Longest Road and Largest Army holders, active seat), the player's own hand and development cards, dice and the roll button, build and buy buttons with costs, end turn, roll for order, the discard picker after a 7, the development card plays (Knight, Road Building, Year of Plenty, Monopoly, reveal VP), **maritime trade** at the rates the server gives, the event log, rule rejections as messages, and a game-over screen.
- **Light motion.** Hover and legal highlights, a dice result display, a short piece drop and a robber move tween, and toasts for key events. All motion is turned off under `prefers-reduced-motion`.

Out of scope:
- Domestic (player-to-player) trading: offers, accept, reject and counter (`trading`). Incoming offers are not shown. Since the client never sends any, a game played only with this client never has open offers.
- Animated 3D dice, cards flying to players, camera moves, sound.
- Spectators, chat, accounts, deployment (`deploy`).
- Rule or server changes.

## Capabilities

### New Capabilities
- `client-session`: the client side of protocol v2. It covers the start screen, create and join, invite links, the lobby and starting a game, seat-token storage and automatic resume, the Replaced close code, and the game store fed only by server messages.
- `board-interaction`: the live game on the board. It covers drawing each player's pieces and the robber from the view, highlighting and picking legal targets, choosing a robber victim, and the light motion on the board.
- `game-hud`: the in-game HUD. It covers player panels, the player's own hand and development cards, turn controls, the build and buy controls, discard, development card plays, maritime trade, the event log, rejection messages, key-event toasts and the game-over screen.

### Modified Capabilities

(none). The board-view "Preview board" requirement already says the preview shows only until the server delivers a game, so it stays true. The board-view and board-topology specs are still in the unarchived `board-topology` change. This change does not modify them.

## Impact

- `apps/client/src/net`: the connection handles v2 messages, the Replaced close code and automatic resume. New intent helpers (create, join, resume, leave, start, act).
- `apps/client/src/store`: `game.ts` becomes the real game store. New `room.ts` (room code, seat, host, seats, status) and `ui.ts` (pending pick, selected cards, toasts).
- `apps/client/src/scene`: new piece, highlight and picking layers. `Scene` switches from the preview to the live board.
- `apps/client/src/hud`: new lobby, player panel, hand, controls, dialog, log, toast and game-over components. `Hud.tsx` becomes the layout shell.
- `apps/client/src/style.css`: HUD and lobby styles. The pending `aurora-background` change also edits this file, so the two must be merged.
- `packages/engine`: no rule changes. The client keeps importing only types and `@hexfall/engine/geometry` (scaffold design decision 6). It may add exports there if the client needs them, for example costs and vertex or edge positions.
- `packages/protocol`, `apps/server`: no changes expected. Protocol v2 is used as it is.
- No new runtime dependencies.
