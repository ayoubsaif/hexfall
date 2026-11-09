## MODIFIED Requirements

### Requirement: Host adds and removes bots
In the lobby the host SHALL be able to add a bot with `addBot` and remove one with `removeBot`. Both SHALL fail with `not_host` from other seats and `game_started` outside the lobby. `addBot` SHALL fail with `room_full` at 6 seats. `removeBot` SHALL fail with `not_a_bot` for a human seat. After removal the remaining seats SHALL close up in order. Changes SHALL be sent to everyone in the room.

#### Scenario: Add a bot
- **WHEN** the host of a 1-player lobby sends `addBot`
- **THEN** everyone sees two seats, the second marked as a bot

#### Scenario: Remove a human by mistake
- **WHEN** the host sends `removeBot` for a human seat
- **THEN** it fails with `not_a_bot` and nothing changes

#### Scenario: Room full of bots
- **WHEN** the host of a 6-seat lobby sends `addBot`
- **THEN** it fails with `room_full`

### Requirement: Play solo from the start screen
The start screen SHALL offer "Play solo vs bots" with a choice of 2 to 5 opponents. It SHALL create a room, add that many bots, and start with the default board mode, the default victory target and no turn timer. With 4 or 5 opponents the game SHALL use the large board.

#### Scenario: Solo with two bots
- **WHEN** the player picks "Play solo" with 2 opponents
- **THEN** a 3-player game starts with the player in seat 0 and two bots

#### Scenario: Solo with five bots
- **WHEN** the player picks "Play solo" with 5 opponents
- **THEN** a 6-player game starts on the large board with the player in seat 0

### Requirement: Lobby bot controls
The lobby SHALL show each bot seat with a bot badge and never as offline. The host SHALL see "Add bot" while there are fewer than 6 seats, "Remove" on bot seats, and a level control (Easy, Normal, Hard) on each bot seat that sends `setBotLevel` when changed and is disabled while a request is pending or the connection is down. Other players SHALL see each bot seat's level as text. The Start button SHALL be enabled for the host with at least one seat, with a note that bots will fill to 3. With 5 or 6 seats the lobby SHALL say the game uses the large board. All text SHALL be available in English and Spanish.

#### Scenario: Start enabled for host alone
- **WHEN** the host is alone in the lobby
- **THEN** Start is enabled and a note says bots will fill the empty seats

#### Scenario: Host changes a bot's level
- **WHEN** the host picks Hard on a bot seat's level control
- **THEN** the client sends `setBotLevel` for that seat with `hard`

#### Scenario: Guest sees the level
- **WHEN** a non-host player views a lobby with a Hard bot
- **THEN** the bot seat shows "Hard" and no level control

#### Scenario: Large board note
- **WHEN** the lobby has 5 seats
- **THEN** it shows that the game will use the large board for 5–6 players

### Requirement: Bots act for themselves
While the game waits for a bot seat (roll for order, setup placement, discard, robber move, Road Building, its own turn, or its Special Building Phase window), or a bot seat holds an open trade offer addressed to it, the server SHALL make that bot's move through the normal action path, so it is validated, stored and replayed like a human action. Moves SHALL be spaced by a short delay so humans can follow. Bots SHALL answer trade offers as defined in "Bots trade with a lone human" and SHALL NOT propose or counter trades. A bot SHALL decide only from its own player view and legal actions, and SHALL NOT draw from the game's random generator. A bot's choices that depend on the score SHALL be scaled to the game's victory target.

#### Scenario: Bot takes its turn
- **WHEN** the active seat is a bot
- **THEN** it rolls, may build or buy, and ends its turn without any human action

#### Scenario: Offer to a bot
- **WHEN** a room has two human seats and one of them proposes a trade to a bot
- **THEN** the bot rejects it and the human sees it rejected

#### Scenario: Bot discards on a seven
- **WHEN** a 7 is rolled and a bot holds 9 cards
- **THEN** the bot discards 4 cards before the robber moves

#### Scenario: Bot in a building window
- **WHEN** a bot's Special Building Phase window opens and it can afford a legal settlement
- **THEN** it builds or passes using only build and pass actions, and never tries to trade
