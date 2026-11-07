## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Bots trade with a lone human
When at most one seat in the room is a human seat (open seats count as bots), a bot holding an open offer SHALL either accept or reject it; it SHALL NOT leave it unanswered. The bot SHALL accept only when all of these hold:
- the offer id is in its legal `acceptTrade` list (it holds the cards asked of it);
- after the trade it is strictly closer to building something it can still build (a city, a settlement, a development card or a road), counting the cards it would receive and give;
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
