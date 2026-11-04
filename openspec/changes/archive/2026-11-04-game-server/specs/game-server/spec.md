## Purpose

The authoritative multiplayer server for Hexfall: rooms and lobby, anonymous seat tokens, validated game actions through the rules engine, per-player redacted updates, presence, and Redis persistence that survives server restarts.

## ADDED Requirements

### Requirement: Room creation and room codes
A client SHALL be able to create a room by sending a display name. The server SHALL create a room with a unique room code and seat the creator as seat 0 and host. It SHALL reply with the room code, the seat and a secret seat token. A room code SHALL be 6 characters from an alphabet without look-alike characters (no 0/O, 1/I/L), and SHALL be matched case-insensitively.

#### Scenario: Create a room
- **WHEN** a client sends create-room with the name "Ana"
- **THEN** it receives a room code, seat 0 and a seat token
- **AND** the room state lists Ana in seat 0 as host, connected, with status "lobby"

#### Scenario: Room codes are case-insensitive
- **WHEN** a client joins with the room code in lower case
- **THEN** it joins the same room

### Requirement: Display names
Display names SHALL be trimmed, 1 to 20 characters long, and free of control characters. Names SHALL be unique within a room, ignoring case. An invalid or taken name SHALL be rejected with `bad_name`.

#### Scenario: Duplicate name
- **WHEN** "ana" tries to join a room that already has "Ana"
- **THEN** the join fails with `bad_name`

### Requirement: Joining and leaving the lobby
While a room is in the lobby, a client SHALL be able to join with the room code and a name, and SHALL get the next free seat in join order plus a seat token. A room SHALL hold at most 4 players. Joining a full room SHALL fail with `room_full`, joining after the game started SHALL fail with `game_started`, and an unknown code SHALL fail with `room_not_found`. A player SHALL be able to leave in the lobby. The remaining seats SHALL then close up in join order, and if the host left, the player now in seat 0 SHALL become host. A room whose last player leaves SHALL be deleted. Every change SHALL be sent to everyone in the room.

#### Scenario: Join order
- **WHEN** Ben and then Cy join Ana's room
- **THEN** Ben is seat 1 and Cy is seat 2

#### Scenario: Room full
- **WHEN** a fifth player tries to join
- **THEN** the join fails with `room_full`

#### Scenario: Host leaves the lobby
- **WHEN** Ana (seat 0, host) leaves a lobby with Ben and Cy
- **THEN** Ben becomes seat 0 and host, and Cy becomes seat 1

### Requirement: Starting a game
Only the host SHALL be able to start, and only in the lobby with 3 or 4 seated players (`not_host`, `not_enough_players` otherwise). The start SHALL choose the board mode (beginner or variable) and optionally a starting seat. The server SHALL create the game with a fresh unpredictable seed and the seated player count. After the start, the seats SHALL be fixed for the rest of the room's life.

#### Scenario: Start with three players
- **WHEN** the host of a 3-player lobby starts a variable game with no starting seat
- **THEN** every player receives their game view in the roll-for-order phase

#### Scenario: Too few players
- **WHEN** the host of a 2-player lobby starts
- **THEN** the start fails with `not_enough_players`

### Requirement: Seat tokens and resume
A seat token SHALL be at least 128 bits of randomness, unguessable, and unique per seat. The server SHALL store only a hash of it. A client SHALL be able to resume a seat by sending the room code and the token. It SHALL then receive the room state and, if a game is running, the full game view. A wrong token SHALL fail with `bad_token`, and the failure SHALL not reveal whether the room exists. If a seat is resumed while another connection holds it, the older connection SHALL be closed with a "replaced" close code.

#### Scenario: Resume after reload
- **WHEN** a player reconnects and sends resume with their room code and token
- **THEN** they get back their seat, the room state and their full game view

#### Scenario: Second tab replaces the first
- **WHEN** the same token resumes from a second connection
- **THEN** the first connection is closed with the "replaced" code and the second one holds the seat

### Requirement: Authoritative game actions
A seated client SHALL send game actions without a seat. The server SHALL fill in the seat bound to the connection, so a client can never act for another seat. Each action SHALL be applied with the rules engine, one at a time per room, in arrival order. A rejected action SHALL be answered to its sender only, with the engine's error code and message, and SHALL change nothing. Messages from a connection with no seat in a running game SHALL fail with `no_seat`. A malformed action SHALL fail as a bad frame.

#### Scenario: Acting for another seat is impossible
- **WHEN** seat 1's client sends an end-turn while seat 0 is active
- **THEN** the server applies it as seat 1 and answers `not_your_turn`
- **AND** no other player receives anything

#### Scenario: Accepted action
- **WHEN** the active player sends roll-dice
- **THEN** every connected player receives an update with the new state version and the new events

### Requirement: Per-player redacted updates
After every accepted action, the server SHALL send each connected player an update with the state version, their own redacted view, their legal actions and the log events added since the previous version, redacted for them. Join and resume SHALL send the full view, including the whole redacted log. A player SHALL never receive another player's hand contents, unrevealed development cards, the deck order or the RNG state.

#### Scenario: Steal stays private
- **WHEN** seat 0 steals from seat 1 in a 4-player game
- **THEN** seats 0 and 1 receive the stolen resource in the steal event
- **AND** seats 2 and 3 receive the steal event without the resource

#### Scenario: Legal moves come with every update
- **WHEN** an update is sent to the active player after the setup phase ends
- **THEN** it includes their legal actions, with roll-dice allowed

### Requirement: Presence
The room state SHALL show each seat's name and whether it is connected, and SHALL be sent to everyone when that changes. A disconnected player SHALL keep their seat. The game SHALL keep waiting for actions that only a disconnected player can take, and the server SHALL NOT take any action on a player's behalf.

#### Scenario: Disconnect during a discard
- **WHEN** a player who owes a discard disconnects
- **THEN** the others see them as disconnected and the game stays in the discard phase until they return and discard

### Requirement: Persistence and recovery
Redis SHALL be the source of truth. An accepted action SHALL be persisted before any player receives its result. If persisting fails or Redis is down, the action SHALL be refused with `unavailable` and the game state SHALL stay as it was. The same SHALL apply to creating, joining, leaving and starting. After a server restart, a room SHALL be rebuilt on first use from its stored snapshot and the actions stored after it, and SHALL equal the state before the restart. A room SHALL expire after 14 days without any change.

#### Scenario: Restart mid-game
- **WHEN** the server restarts after 40 actions and a player resumes
- **THEN** their view equals the view they had before the restart, and the next action applies normally

#### Scenario: Redis down
- **WHEN** Redis is unreachable and the active player rolls
- **THEN** the roll is refused with `unavailable` and no one receives an update

### Requirement: Abuse limits
The server SHALL limit each connection to a bounded rate of messages and SHALL answer excess messages with `rate_limited` without processing them. Frames SHALL stay limited to 64 KB.

#### Scenario: Flooding
- **WHEN** a connection sends 100 messages within one second
- **THEN** the messages beyond the limit are answered with `rate_limited` and not applied
