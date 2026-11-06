# bots Specification

## Purpose

Let seats be played by server-run bots so a game can be played solo or with empty seats filled, without changing any game rule.

## Requirements

### Requirement: Bot seats
A seat SHALL be able to be a bot. A bot seat SHALL have a name from a reserved pool that is unique in the room (case-insensitive), SHALL be reported to clients with `bot: true`, SHALL always be reported connected, and SHALL have no usable seat token, so it cannot be resumed or listed in saved games. Bot seats SHALL count as players for everything in the game (turn order, setup, bank, scoring).

#### Scenario: Bot shown as connected
- **WHEN** a room has a bot in seat 1
- **THEN** the room state shows seat 1 with `bot: true` and `connected: true`

#### Scenario: Name clash
- **WHEN** a human named like a bot-pool name is already in the room
- **THEN** the bot gets another free pool name

### Requirement: Host adds and removes bots
In the lobby the host SHALL be able to add a bot with `addBot` and remove one with `removeBot`. Both SHALL fail with `not_host` from other seats and `game_started` outside the lobby. `addBot` SHALL fail with `room_full` at 4 seats. `removeBot` SHALL fail with `not_a_bot` for a human seat. After removal the remaining seats SHALL close up in order. Changes SHALL be sent to everyone in the room.

#### Scenario: Add a bot
- **WHEN** the host of a 1-player lobby sends `addBot`
- **THEN** everyone sees two seats, the second marked as a bot

#### Scenario: Remove a human by mistake
- **WHEN** the host sends `removeBot` for a human seat
- **THEN** it fails with `not_a_bot` and nothing changes

### Requirement: Auto-fill on start
When the host starts a game with fewer than 3 seats, the server SHALL add bots until there are 3 seats, then start. Seats SHALL be fixed after the start as for any game.

#### Scenario: One human starts
- **WHEN** a lobby with only the host is started
- **THEN** two bots are added and the game starts with 3 players

### Requirement: Play solo from the start screen
The start screen SHALL offer "Play solo vs bots" with a choice of 2 or 3 opponents. It SHALL create a room, add that many bots, and start with the default board mode and no turn timer.

#### Scenario: Solo with two bots
- **WHEN** the player picks "Play solo" with 2 opponents
- **THEN** a 3-player game starts with the player in seat 0 and two bots

### Requirement: Lobby bot controls
The lobby SHALL show each bot seat with a bot badge and never as offline. The host SHALL see "Add bot" while there are fewer than 4 seats and "Remove" on bot seats. The Start button SHALL be enabled for the host with at least one seat, with a note that bots will fill to 3. All text SHALL be available in English and Spanish.

#### Scenario: Start enabled for host alone
- **WHEN** the host is alone in the lobby
- **THEN** Start is enabled and a note says bots will fill the empty seats

### Requirement: Bots act for themselves
While the game waits for a bot seat (roll for order, setup placement, discard, robber move, Road Building, or its own turn), the server SHALL make that bot's move through the normal action path, so it is validated, stored and replayed like a human action. Moves SHALL be spaced by a short delay so humans can follow. Bots SHALL reject every trade offer made to them and SHALL NOT propose trades. A bot SHALL decide only from its own player view and legal actions, and SHALL NOT draw from the game's random generator.

#### Scenario: Bot takes its turn
- **WHEN** the active seat is a bot
- **THEN** it rolls, may build or buy, and ends its turn without any human action

#### Scenario: Offer to a bot
- **WHEN** a human proposes a trade to a bot
- **THEN** the bot rejects it and the human sees it rejected

#### Scenario: Bot discards on a seven
- **WHEN** a 7 is rolled and a bot holds 9 cards
- **THEN** the bot discards 4 cards before the robber moves

### Requirement: Bots are legal and finish games
Every action a bot sends SHALL be accepted by the engine. A game with only bots SHALL run to a win without stalling.

#### Scenario: Bots-only fuzz
- **WHEN** 100 seeded games run with 3 and 4 bots
- **THEN** every game ends with a winner and no action is rejected

### Requirement: Bots follow pause and recovery
While a room is paused or ended the server SHALL NOT make bot moves. On resume, and when a room is loaded from storage, bot moves SHALL continue from the stored state.

#### Scenario: Resume continues bots
- **WHEN** the host resumes a game that was paused on a bot's turn
- **THEN** the bot moves after the resume

### Requirement: Saved games with bots
A listed saved game SHALL mark bot seats in its player names, and a room SHALL be listed only through human seat tokens.

#### Scenario: Solo game listed
- **WHEN** a player has a solo game with two bots
- **THEN** the list shows their name and the two bots marked as bots
