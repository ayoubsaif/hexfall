## Purpose

The client side of the multiplayer session: the start screen, room create and join, invite links, the lobby and game start, keeping a seat across reloads and reconnects, and the client stores that mirror what the server last sent.

## ADDED Requirements

### Requirement: Start screen
When the client is not in a room, it SHALL show a start screen over the preview board. From there the player SHALL be able to create a room or join one. Creating SHALL ask for a display name. Joining SHALL ask for a room code and a display name. The client SHALL trim the name and check its length (1–20 characters) before sending. Room codes SHALL be accepted in any case. Create and join controls SHALL be disabled while the connection is not open.

#### Scenario: Create a room
- **WHEN** the player enters "Ana" and chooses Create
- **THEN** the client sends `createRoom` with the name "Ana"
- **AND** on `roomJoined` it shows the lobby for the new room code with Ana in seat 0 as host

#### Scenario: Name too long
- **WHEN** the player enters a 25-character name
- **THEN** the Create and Join controls stay disabled and a hint gives the limit

#### Scenario: Offline
- **WHEN** the connection status is "reconnecting"
- **THEN** Create and Join are disabled and the connection badge shows the status

### Requirement: Invite links
The lobby SHALL show the room code and a copyable invite link that carries it. Opening an invite link SHALL show the start screen with the join form already filled with that room code, so that only a name is needed. A room code in the link SHALL be accepted in any case.

#### Scenario: Open an invite link
- **WHEN** a player opens the invite link for room "K7QX2M" with no saved seat for that room
- **THEN** the join form shows room code "K7QX2M" and asks only for a name

### Requirement: Server errors on the start screen and lobby
Room errors from the server SHALL be shown next to the form or control that caused them, in plain words: `bad_name` (name invalid or taken), `room_not_found`, `room_full`, `game_started`, `not_host`, `not_enough_players`, `unavailable` and `rate_limited`. An error SHALL NOT clear what the player typed.

#### Scenario: Room full
- **WHEN** the player joins a room with 4 players
- **THEN** the join form says the room is full and keeps the code and name

#### Scenario: Name taken
- **WHEN** the server answers a join with `bad_name`
- **THEN** the form says the name is invalid or already taken in that room

### Requirement: Lobby
In the lobby the client SHALL show the room code, the invite link, and each seat with its name, color, host mark and connected state, updated on every `roomState`. The player's own seat SHALL be marked. Only the host SHALL see the start controls: board mode (beginner or variable, defaulting to variable), an optional starting player chosen from the seated players (defaulting to "roll for it"), and Start. Start SHALL be enabled only with 3 or 4 seated players. Every player SHALL be able to leave the lobby, which SHALL send `leaveRoom`, forget the seat token for that room, and return to the start screen on `roomLeft`.

#### Scenario: Host starts with three players
- **WHEN** the host of a 3-player lobby picks beginner mode and no starting player and chooses Start
- **THEN** the client sends `startGame` with mode "beginner" and no starting player

#### Scenario: Not enough players
- **WHEN** the host is alone with one other player
- **THEN** Start is disabled and the lobby says 3 or 4 players are needed

#### Scenario: Non-host view
- **WHEN** a player who is not the host is in the lobby
- **THEN** they see the seat list and Leave but no start controls

#### Scenario: Host changes
- **WHEN** the host leaves and a `roomState` names the remaining player in seat 0 as host
- **THEN** that player now sees the start controls

### Requirement: Seat tokens and automatic resume
On `roomJoined` with a token, the client SHALL save the room code and token in browser storage. On every `welcome` (first connect, reconnect, or after a server restart), if a seat is saved for the room in the address or the last room used, the client SHALL send `resumeRoom` before any other room message. A successful resume SHALL restore the lobby or the game from the `roomState` and `gameSnapshot` that follow. If the resume fails with `bad_token` or `room_not_found`, the client SHALL forget that saved seat and show the start screen with a short notice. If browser storage is unavailable, the client SHALL still work for the current page, without resume after a reload.

#### Scenario: Reload mid-game
- **WHEN** a seated player reloads the page during a game
- **THEN** the client resumes the seat and shows the same board, hand and turn as before the reload

#### Scenario: Server restart
- **WHEN** the server restarts with close code 1012 and the client reconnects
- **THEN** the client resumes the seat on its own after `welcome`, and play continues

#### Scenario: Stale token
- **WHEN** a saved token is answered with `bad_token`
- **THEN** the client deletes that saved seat and shows the start screen with a notice that the seat could not be restored

### Requirement: Replaced connection
If the server closes the socket with close code 4001 (Replaced), the client SHALL NOT reconnect. It SHALL show a notice that the game is open in another tab or window, with a control to take the seat back here. That control SHALL reconnect and resume, which in turn replaces the other connection.

#### Scenario: Second tab
- **WHEN** the same seat is resumed in a second tab
- **THEN** the first tab stops reconnecting and shows the "open in another tab" notice with a "Play here" control

### Requirement: Game store mirrors the server
The client SHALL keep the latest game view, legal moves, state version and redacted log in a store written only from server messages. A `gameSnapshot` SHALL replace the view, legal moves, version and the whole log. A `gameUpdate` SHALL replace the view and legal moves and append its events to the log, but only if its version is newer than the stored one. If its log length does not match the stored log plus the new events, the client SHALL get a fresh snapshot by reconnecting and resuming the seat (the server refuses a second resume on a connection that already holds a seat). The client SHALL NOT change game state on its own, and SHALL NOT decide which moves are legal: it SHALL only use the legal moves from the server. Leaving the room or a failed resume SHALL clear the game store.

#### Scenario: Update applied in order
- **WHEN** the store holds version 10 and a `gameUpdate` with version 11 and 2 events arrives
- **THEN** the view and legal moves are replaced and the log grows by those 2 events

#### Scenario: Old update ignored
- **WHEN** the store holds version 12 and a `gameUpdate` with version 11 arrives
- **THEN** the store does not change

#### Scenario: Log gap
- **WHEN** a `gameUpdate` reports a log length that does not equal the stored log length plus its events
- **THEN** the client opens a new connection, resumes the seat, and replaces the store from the `gameSnapshot` that follows

### Requirement: Sending game actions
The client SHALL send game actions as `gameAction` messages without a seat. While an action is in flight (sent, with no `gameUpdate` or `actionRejected` yet), the client SHALL disable the controls that send actions, to avoid double sends. A disconnect SHALL end the in-flight state. On `actionRejected`, the client SHALL end the in-flight state and keep the view unchanged.

#### Scenario: No double roll
- **WHEN** the player clicks Roll twice quickly
- **THEN** only one `rollDice` action is sent
