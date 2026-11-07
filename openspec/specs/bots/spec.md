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
While the game waits for a bot seat (roll for order, setup placement, discard, robber move, Road Building, or its own turn), or a bot seat holds an open trade offer addressed to it, the server SHALL make that bot's move through the normal action path, so it is validated, stored and replayed like a human action. Moves SHALL be spaced by a short delay so humans can follow. Bots SHALL answer trade offers as defined in "Bots trade with a lone human" and SHALL NOT propose or counter trades. A bot SHALL decide only from its own player view and legal actions, and SHALL NOT draw from the game's random generator.

#### Scenario: Bot takes its turn
- **WHEN** the active seat is a bot
- **THEN** it rolls, may build or buy, and ends its turn without any human action

#### Scenario: Offer to a bot
- **WHEN** a room has two human seats and one of them proposes a trade to a bot
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

### Requirement: Bots trade with a lone human
When at most one seat in the room is a human seat (open seats count as bots), a bot holding an open offer SHALL either accept or reject it; it SHALL NOT leave it unanswered. The bot SHALL accept only when all of these hold:
- the offer id is in its legal `acceptTrade` list (it holds the cards asked of it);
- after the trade its hand is worth more by a small margin, where a hand's worth counts its progress towards the best thing it can still build (a city, a settlement, a development card or a road), a smaller share of its progress towards each other such build, and a little for each card held (so a generous offer is worth more than a fair one);
- the trade does not take away a card it needs for something it could already build before the trade;
- the proposer has fewer than 8 public victory points.

Otherwise it SHALL reject the offer. When the same offer is addressed to several bots, each bot SHALL decide on its own, and the first acceptance completes the trade (engine rule). The decision SHALL be deterministic for the same view and offer. Bots SHALL answer an offer made to them on their own turn (a human offering to the active bot) before taking any other turn action. When two or more seats are human seats, bots SHALL reject every offer.

#### Scenario: Offer completes a settlement
- **WHEN** in a solo game a bot holds brick, lumber and wool, and the human offers 1 grain for 1 of the bot's 2 ore
- **THEN** the bot accepts and both hands change as offered

#### Scenario: Useless offer
- **WHEN** in a solo game the human offers a card the bot does not need for any build in exchange for one it needs
- **THEN** the bot rejects it

#### Scenario: Would break an affordable build
- **WHEN** a bot can already afford a city and the human asks for one of its ore
- **THEN** the bot rejects the offer

#### Scenario: Cannot pay
- **WHEN** the human asks a bot for a card it does not hold
- **THEN** the bot rejects the offer and does not attempt to accept it

#### Scenario: Leader protection
- **WHEN** the human has 8 public victory points and offers a trade the bot would otherwise accept
- **THEN** the bot rejects it

#### Scenario: Offer to several bots
- **WHEN** the human offers to two bots and both would accept
- **THEN** exactly one trade happens and the offer closes

#### Scenario: Offer to the active bot
- **WHEN** it is a bot's turn and the human offers it a trade
- **THEN** the bot answers the offer before it builds or ends its turn

#### Scenario: Seat left by a human
- **WHEN** one of two humans leaves and their seat becomes an open bot seat
- **THEN** from then on bots answer the remaining human's offers on their merits

### Requirement: Bot recipients in the offer composer
The offer composer SHALL mark each bot recipient with the robot icon used on player panels. When two or more seats are human seats and at least one selected recipient is a bot, the composer SHALL show a one-line hint that bots only trade in games with one human player. The text SHALL be available in English and Spanish.

#### Scenario: Solo game composer
- **WHEN** the human opens the composer in a game against two bots
- **THEN** both recipients show the robot icon and no hint is shown

#### Scenario: Mixed game composer
- **WHEN** a room has two humans and a bot, and the bot is a selected recipient
- **THEN** the composer shows the hint that bots will not trade

### Requirement: Bot pacing
While at least one human is connected, the server SHALL wait at least 2 seconds before each bot move and at least 3 seconds before a bot starts its turn. Right after any action that rolled dice (a turn roll, a roll for order, or a roll made by the turn timer), the next bot move SHALL wait for the full dice throw plus 1 second. With nobody connected, bots MAY move without these delays.

#### Scenario: Bot after a roll
- **WHEN** a player rolls the dice and a bot moves next
- **THEN** the bot does not move until the dice throw has finished and 1 more second has passed

#### Scenario: Readable bot turn
- **WHEN** a bot builds twice in its turn while a human watches
- **THEN** at least 2 seconds pass between the two builds
