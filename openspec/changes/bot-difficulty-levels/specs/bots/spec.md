## ADDED Requirements

### Requirement: Bot difficulty levels
Every bot seat SHALL have a level: `easy`, `normal` or `hard`. A bot added in the lobby, or added on start to fill the room, SHALL be `normal`. A seat a human left during the game SHALL play at `normal`. A stored room or saved game whose bot seat has no level, or an unknown level, SHALL play that seat at `normal`. The room state SHALL report the level of every bot seat to everyone in the room; human seats SHALL have no level.

In the lobby the host SHALL be able to change a bot seat's level with `setBotLevel { seat, level }`. It SHALL fail with `not_host` from other seats, `game_started` outside the lobby, and `not_a_bot` for a human seat. The change SHALL be stored before it is sent to everyone in the room. After the start the level of each seat SHALL be fixed.

The level SHALL change only which legal move a bot picks, never which moves are legal. A bot's choices at every level SHALL be deterministic for the same view, legal actions and bot random seed, and SHALL NOT draw from the game's random generator. Bots of every level SHALL be accepted by the engine and SHALL finish bots-only games.

- **Easy**: on placement, build, discard, robber and card choices it SHALL, about one decision in three, pick a random legal option instead of its best one. When it moves the robber it SHALL steal from a random qualifying opponent.
- **Normal**: it SHALL pick its best-scored option, with a small random tie-break. When it moves the robber it SHALL prefer opponents with more public victory points and more cards.
- **Hard**: it SHALL always pick its best-scored option. When it moves the robber it SHALL prefer a hex that blocks the opponent with the most public victory points and SHALL steal from that opponent when they qualify.

#### Scenario: Default level
- **WHEN** the host adds a bot in the lobby
- **THEN** the room state shows that bot seat at Normal

#### Scenario: Host sets a level
- **WHEN** the host sends `setBotLevel` with seat 1 and `hard`, and seat 1 is a bot
- **THEN** the stored room and the room state everyone receives show seat 1 at Hard

#### Scenario: Not the host
- **WHEN** a non-host player sends `setBotLevel`
- **THEN** it fails with `not_host` and no level changes

#### Scenario: Human seat
- **WHEN** the host sends `setBotLevel` for a human seat
- **THEN** it fails with `not_a_bot`

#### Scenario: After the start
- **WHEN** the host sends `setBotLevel` while the game is playing
- **THEN** it fails with `game_started`

#### Scenario: Old saved game
- **WHEN** a room stored before levels existed is resumed
- **THEN** its bot seats play at Normal and the room state shows Normal

#### Scenario: Hard targets the leader
- **WHEN** a Hard bot moves the robber and two opponents qualify, one with 7 public victory points and one with 3
- **THEN** it steals from the one with 7

#### Scenario: Every level finishes games
- **WHEN** seeded bots-only games run with Easy, Normal and Hard bots
- **THEN** every game ends with a winner and no bot action is rejected

## MODIFIED Requirements

### Requirement: Bots trade with a lone human
When at most one seat in the room is a human seat (open seats count as bots), a bot holding an open offer SHALL either accept or reject it; it SHALL NOT leave it unanswered. At every level the bot SHALL reject the offer unless both of these hold:
- the offer id is in its legal `acceptTrade` list (it holds the cards asked of it);
- the trade does not take away a card it needs for something it could already build before the trade.

A hand's progress towards a build is how few cards it still lacks for it, for each thing it can still build (a city, a settlement, a development card or a road). On top of the checks above, the bot SHALL accept only when its level's rule holds, counting the cards it would receive and give:
- **Hard**: the proposer has fewer than 8 public victory points; it gives away only surplus, so for every resource it would pay, it still holds after the trade at least as many as any single thing it can still build costs of that resource; and after the trade its progress towards the best thing it can still build rises by a small margin (other builds and extra cards count for almost nothing).
- **Normal**: the proposer has fewer than 9 public victory points, and either the Hard rule (without its victory-point limit) holds, or after the trade its hand is worth more by a small margin, where a hand's worth counts its progress towards the best thing it can still build, a smaller share of its progress towards each other such build, and a little for each card held (so a generous offer is worth more than a fair one).
- **Easy**: the proposer's victory points do not matter, and either the Normal rule (without its victory-point limit) holds, or after the trade its hand is worth at least as much as before, counting each card held clearly in its favour (so an offer that only adds spare cards is accepted).

So Easy SHALL accept every offer Normal accepts, and Normal every offer Hard accepts. When the same offer is addressed to several bots, each bot SHALL decide on its own, and the first acceptance completes the trade (engine rule). The decision SHALL be deterministic for the same view, offer and level. Bots SHALL answer an offer made to them on their own turn (a human offering to the active bot) before taking any other turn action. When two or more seats are human seats, bots of every level SHALL reject every offer.

#### Scenario: Offer completes a settlement
- **WHEN** in a solo game a bot holds brick, lumber and wool, and the human offers 1 grain for 1 of the bot's 2 ore
- **THEN** an Easy or Normal bot accepts and both hands change as offered, and a Hard bot that can still build a city rejects it, because a city needs 3 ore

#### Scenario: Hard keeps what its builds need
- **WHEN** a Hard bot holding 1 brick, 3 ore and 1 grain, with roads and settlements left, is offered 2 grain for its brick
- **THEN** it rejects the offer, even though the grain would make a city affordable, and Easy and Normal bots accept it

#### Scenario: Hard trades surplus
- **WHEN** a Hard bot holding 4 ore and 1 grain is offered 1 grain for 1 ore by a proposer under 8 public victory points
- **THEN** it accepts, since the fourth ore is surplus and the grain completes a city

#### Scenario: Useless offer
- **WHEN** in a solo game the human offers a card the bot does not need for any build in exchange for one it needs for its best build
- **THEN** a bot of any level rejects it

#### Scenario: Would break an affordable build
- **WHEN** a bot of any level can already afford a city and the human asks for one of its ore
- **THEN** the bot rejects the offer

#### Scenario: Cannot pay
- **WHEN** the human asks a bot for a card it does not hold
- **THEN** the bot rejects the offer and does not attempt to accept it

#### Scenario: Leader protection
- **WHEN** the human has 8 public victory points and offers a trade every level would otherwise accept
- **THEN** a Hard bot rejects it, and Normal and Easy bots accept it

#### Scenario: Near the win
- **WHEN** the human has 9 public victory points
- **THEN** Hard and Normal bots reject every offer, and an Easy bot still judges it on its merits

#### Scenario: Extra cards win over Easy
- **WHEN** the human offers an Easy bot 2 cards it doesn't need for 1 card it doesn't need
- **THEN** the Easy bot accepts, and a Hard bot rejects the same offer

#### Scenario: Generous beats fair
- **WHEN** a Normal bot holding 3 lumber and 1 ore is offered 1 ore for 1 lumber, and in another game 2 ore for 1 lumber
- **THEN** it rejects the fair swap and accepts the generous one

#### Scenario: Second plan
- **WHEN** an offer brings a bot's second-best build closer without changing its best one, and gives it at least as many cards as it pays
- **THEN** a Normal bot accepts it and a Hard bot rejects it

#### Scenario: Acceptance rises as the level falls
- **WHEN** the same 2,000 random bot hands of 3 to 7 cards are each offered a 1:1, a 2:1 and a 3:1 trade, and judged at every level
- **THEN** at every ratio Easy accepts more offers than Normal, and Normal more than twice as many as Hard

#### Scenario: Offer to several bots
- **WHEN** the human offers to two bots and both would accept
- **THEN** exactly one trade happens and the offer closes

#### Scenario: Offer to the active bot
- **WHEN** it is a bot's turn and the human offers it a trade
- **THEN** the bot answers the offer before it builds or ends its turn

#### Scenario: Seat left by a human
- **WHEN** one of two humans leaves and their seat becomes an open bot seat
- **THEN** from then on bots answer the remaining human's offers on their merits, the open seat at Normal

### Requirement: Lobby bot controls
The lobby SHALL show each bot seat with a bot badge and never as offline. The host SHALL see "Add bot" while there are fewer than 4 seats, "Remove" on bot seats, and a level control (Easy, Normal, Hard) on each bot seat that sends `setBotLevel` when changed and is disabled while a request is pending or the connection is down. Other players SHALL see each bot seat's level as text. The Start button SHALL be enabled for the host with at least one seat, with a note that bots will fill to 3. All text SHALL be available in English and Spanish.

#### Scenario: Start enabled for host alone
- **WHEN** the host is alone in the lobby
- **THEN** Start is enabled and a note says bots will fill the empty seats

#### Scenario: Host changes a bot's level
- **WHEN** the host picks Hard on a bot seat's level control
- **THEN** the client sends `setBotLevel` for that seat with `hard`

#### Scenario: Guest sees the level
- **WHEN** a non-host player views a lobby with a Hard bot
- **THEN** the bot seat shows "Hard" and no level control
