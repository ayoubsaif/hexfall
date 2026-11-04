## Purpose

The deterministic Catan base-game rules engine: a pure state machine that creates games, validates and applies every player action per AGENTS.md, generates legal moves, logs events and produces redacted per-player views.

## ADDED Requirements

### Requirement: Deterministic pure reducer
The engine SHALL expose game creation and an action reducer that are pure functions of their inputs. All randomness (board, deck shuffle, dice, steals, roll-for-order) SHALL come from the seeded RNG stored in the state. The reducer SHALL never mutate its input, and SHALL return either the next state with the events it produced or a typed rule error that leaves the state unchanged. The state SHALL survive a JSON round-trip.

#### Scenario: Same seed and actions give the same game
- **WHEN** two games are created with the same config and the same action sequence is applied to both
- **THEN** the resulting states are deep-equal

#### Scenario: Illegal action is rejected without change
- **WHEN** a player who is not active rolls the dice
- **THEN** the reducer returns an error with code `not_your_turn` and the original state is unchanged

### Requirement: Game creation
Creating a game SHALL take a seed, a player count of 3 or 4 and a board mode. Beginner mode SHALL use the fixed beginner board and variable mode a seeded variable board. Each player SHALL start with 15 roads, 5 settlements, 4 cities, no cards and 0 VP. The bank SHALL hold 19 of each resource, the 25-card development deck (14 Knight, 2 Road Building, 2 Year of Plenty, 2 Monopoly, 5 VP) SHALL be shuffled, the robber SHALL be on the desert, and Longest Road and Largest Army SHALL be unowned. Player counts other than 3 or 4 SHALL be rejected.

#### Scenario: Initial components
- **WHEN** a 3-player variable game is created
- **THEN** the bank holds 95 cards, the deck holds 25 cards with the listed composition, and each player has 15/5/4 pieces

### Requirement: Starting player
If a starting player is given, setup SHALL begin with that player. Otherwise every player SHALL roll both dice in seat order, the highest roll starts, and players tied for the highest SHALL re-roll among themselves until one is highest.

#### Scenario: Tie re-roll
- **WHEN** seats 0 and 2 tie for the highest roll
- **THEN** only seats 0 and 2 roll again, and the highest of that roll becomes the starting player

### Requirement: Setup phase snake order
Round 1 SHALL run from the starting player clockwise, and round 2 in reverse order, so the starting player places last. Each placement SHALL be one settlement on a free intersection obeying the Distance Rule (no connection needed) followed by one road on a path touching that settlement. After placing their second settlement, a player SHALL receive 1 card per adjacent terrain hex (none for the desert), taken from the bank. When setup ends, the starting player SHALL take the first normal turn, and each player SHALL have 2 VP.

#### Scenario: Snake order with 4 players
- **WHEN** the starting player is seat 1 in a 4-player game
- **THEN** placements go 1, 2, 3, 0, 0, 3, 2, 1 and seat 1 then takes the first turn

#### Scenario: Setup road must touch the new settlement
- **WHEN** a player places a setup road on a path not touching the settlement just placed
- **THEN** the action fails with `illegal_placement`

#### Scenario: Starting resources from the second settlement only
- **WHEN** a player places a second settlement touching fields, hills and the desert
- **THEN** they receive exactly 1 grain and 1 brick, and the first settlement gave nothing

### Requirement: Turn structure
On a normal turn the active player SHALL roll exactly once before trading, building or buying, and SHALL NOT end the turn before rolling. Trading and building SHALL then be interleaved freely. Development cards SHALL be playable before or after the roll. Ending the turn SHALL pass play to the next seat clockwise and reset the per-turn flags.

#### Scenario: Building before rolling is rejected
- **WHEN** the active player builds a road before rolling
- **THEN** the action fails with `must_roll_first`

#### Scenario: Rolling twice is rejected
- **WHEN** the active player rolls a second time in a turn
- **THEN** the action fails with `already_rolled`

### Requirement: Resource production
A roll other than 7 SHALL pay, for every hex with that token not under the robber, 1 card per adjacent settlement and 2 per adjacent city to their owners. If the bank cannot pay the full amount of one resource, nobody SHALL receive that resource, unless only one player is owed it, in which case that player SHALL receive what remains. Other resources SHALL be unaffected.

#### Scenario: Robber blocks a hex
- **WHEN** an 8 is rolled and the robber is on one of the 8 hexes
- **THEN** buildings next to that hex receive nothing from it

#### Scenario: Shortage with several players
- **WHEN** 3 ore remain in the bank and two players are owed 2 ore each
- **THEN** neither receives ore and the bank still holds 3 ore

#### Scenario: Shortage with one player
- **WHEN** 1 ore remains and only one player is owed 2 ore
- **THEN** that player receives 1 ore and the bank holds 0 ore

### Requirement: Rolling a 7
A 7 SHALL produce nothing. Every player holding more than 7 resource cards SHALL discard floor(n/2) cards of their choice to the bank, and the robber SHALL NOT move until all discards are done. The roller SHALL then move the robber to a different hex and steal 1 random card from one opponent with a building next to that hex, chosen by the roller. If no opponent qualifies there is no steal, and an empty-handed victim gives nothing. The roller SHALL NOT steal from themself.

#### Scenario: Discard threshold
- **WHEN** a 7 is rolled and players hold 7, 8 and 11 cards
- **THEN** they must discard 0, 4 and 5 cards respectively

#### Scenario: Robber must move
- **WHEN** the roller moves the robber to the hex it already occupies
- **THEN** the action fails with `illegal_robber_hex`

#### Scenario: No qualifying victim
- **WHEN** the robber moves to a hex with no opponent buildings
- **THEN** the victim must be null and nothing is stolen

### Requirement: Building
Roads (1 brick, 1 lumber) SHALL go on an empty path connected to the builder's own road, settlement or city, and SHALL NOT connect through an intersection holding an opponent's building. Settlements (brick, lumber, wool, grain) SHALL go on an empty intersection touching the builder's road and obeying the Distance Rule for every player's buildings. Cities (3 ore, 2 grain) SHALL only replace the builder's own settlement, returning it to supply. Paid cards SHALL return to the bank, and nothing SHALL be built when the matching supply is empty.

#### Scenario: Distance Rule against own building
- **WHEN** a player builds a settlement one path away from their own settlement
- **THEN** the action fails with `illegal_placement`

#### Scenario: Road blocked by opponent settlement
- **WHEN** a player's only connection to a path is through an intersection with an opponent's settlement
- **THEN** that path is not a legal road placement

#### Scenario: City returns settlement to supply
- **WHEN** a player with 2 settlements left upgrades a settlement to a city
- **THEN** they have 3 settlements and 3 cities left and their VP rises by 1

#### Scenario: Out of pieces
- **WHEN** a player with no roads left tries to build a road
- **THEN** the action fails with `no_pieces`

### Requirement: Development cards
Buying (ore, wool, grain) SHALL take the top deck card into the buyer's hidden hand, and SHALL fail on an empty deck. At most one Knight or Progress card SHALL be played per turn, and never one bought this turn. Knight SHALL move the robber and steal as for a 7, without discards. Road Building SHALL place up to 2 free roads by normal road rules. Year of Plenty SHALL take 2 bank cards of the player's choice. Monopoly SHALL take all cards of the named resource from every other player. Played Knights SHALL stay in front of the player, and Progress cards SHALL leave the game.

#### Scenario: Card bought this turn
- **WHEN** a player plays a Knight bought this turn
- **THEN** the action fails with `card_not_playable`

#### Scenario: Second card in a turn
- **WHEN** a player who played a Knight plays Monopoly in the same turn
- **THEN** the action fails with `dev_card_already_played`

#### Scenario: Knight before the roll
- **WHEN** the active player plays a Knight before rolling
- **THEN** they move the robber and steal, no one discards, and they still must roll

#### Scenario: Monopoly
- **WHEN** a player names wool while opponents hold 2 and 0 wool
- **THEN** the player gains 2 wool and opponents hold 0

### Requirement: Victory point cards
VP cards SHALL be hidden and count only when revealed. A player SHALL be able to reveal them only on their own turn, only when the revealed total brings them to 10 or more VP, including on the turn they were bought. The engine SHALL track hidden VP separately from public VP.

#### Scenario: Reveal to win
- **WHEN** a player with 9 public VP and 1 VP card reveals on their turn
- **THEN** they win with 10 VP

#### Scenario: Reveal below 10 is rejected
- **WHEN** a player with 7 public VP and 1 VP card tries to reveal
- **THEN** the action fails with `cannot_reveal`

### Requirement: Longest Road
The first player with a continuous road of 5 or more segments SHALL get Longest Road (2 VP). A continuous road counts each segment once, and SHALL be broken at intersections holding an opponent's building. A player with a strictly longer road SHALL take the card. A tied holder SHALL keep it. If the holder no longer has the longest road, the card SHALL go to a unique new longest player with 5 or more, or else be set aside. Lengths SHALL be recomputed after every road and settlement placement.

#### Scenario: Loop and fork
- **WHEN** a player's roads form a 6-segment loop around one hex plus a 2-segment branch leaving one loop intersection
- **THEN** their longest road is 8 (the branch then the whole loop, each segment counted once)

#### Scenario: Broken road with tied challengers
- **WHEN** the holder's road is broken to 4 and two other players each have 5
- **THEN** Longest Road is set aside unowned

#### Scenario: Tie keeps the card
- **WHEN** another player reaches the holder's length
- **THEN** the holder keeps Longest Road

### Requirement: Largest Army
The first player with 3 played Knights SHALL get Largest Army (2 VP). A player with strictly more played Knights than the holder SHALL take it. Ties SHALL never move it.

#### Scenario: Strictly more knights
- **WHEN** the holder has 3 Knights and another player plays their 3rd
- **THEN** the holder keeps Largest Army, and the other player takes it when playing their 4th

### Requirement: Domestic trade
Trades SHALL happen only after the roll on the active player's turn, and the active player SHALL be a party to every trade. A trade SHALL give at least one card on each side, SHALL NOT have the same resource on both sides, and SHALL contain only resource cards. Players SHALL be able to propose, accept, reject and cancel offers, and counter-offers SHALL be new offers. Acceptance SHALL fail if either side lacks the cards.

#### Scenario: Gift rejected
- **WHEN** the active player offers 1 ore for nothing
- **THEN** the action fails with `invalid_trade`

#### Scenario: Like-for-like rejected
- **WHEN** an offer gives ore and asks for ore
- **THEN** the action fails with `invalid_trade`

#### Scenario: Non-active players cannot trade together
- **WHEN** a non-active player addresses an offer to another non-active player
- **THEN** the action fails with `invalid_trade`

### Requirement: Maritime trade
The active player SHALL be able to trade with the bank after the roll: 4 identical cards for 1 of another type, 3 for 1 with a generic harbor, and 2 for 1 of the harbor's resource with a special harbor. A harbor SHALL count when the player owns a building on either intersection of its path, including one built this turn. The bank SHALL hold the requested cards.

#### Scenario: Special harbor rate only for its resource
- **WHEN** a player owns only a 2:1 ore harbor and trades wool
- **THEN** the wool rate is 4:1, and 4 ore buys 2 cards

### Requirement: Victory
The game SHALL end immediately when the active player has 10 or more VP during their own turn, checked after every state change. A player who reaches 10 during another player's turn SHALL not win then, and SHALL win at the start of their own next turn if they still have 10. After the game ends, every action SHALL be rejected.

#### Scenario: Win on own turn
- **WHEN** the active player with 9 VP builds a settlement
- **THEN** the game ends with them as winner

#### Scenario: Not on another player's turn
- **WHEN** a player reaches 10 VP through a Longest Road transfer during another player's turn
- **THEN** the game continues until their own turn starts

### Requirement: Legal-move generation
For any state and seat, the engine SHALL list every legal action the seat may take now: setup placements, rolling, discard obligation, robber hexes with their victims, road paths, settlement intersections, city targets, whether a development card can be bought, playable development cards, maritime rates, whether VP cards can be revealed, trade actions and ending the turn. Every listed move SHALL be accepted by the reducer.

#### Scenario: Listed moves are accepted
- **WHEN** a random legal action from the list is applied at each step of a seeded game
- **THEN** the reducer never returns an error

### Requirement: Event log and hidden information
Every applied action SHALL append events to the game log: rolls, production per player, discards, robber moves, steals, builds, purchases, card plays, trades, special-card changes and victory. The engine SHALL produce a per-seat view that shows each opponent's card counts, played Knights and public VP, but not their hand contents, unrevealed development cards, the deck order or the RNG state. A steal SHALL name the stolen card only to the thief and the victim, and a purchase SHALL name the card only to the buyer.

#### Scenario: Opponent hand hidden
- **WHEN** seat 1 requests its view
- **THEN** seat 0's resources appear only as a count, and seat 0's development cards only as a count

#### Scenario: Steal redaction
- **WHEN** seat 0 steals from seat 1
- **THEN** seats 0 and 1 see the stolen resource in the log, and seat 2 sees only that a card was stolen
