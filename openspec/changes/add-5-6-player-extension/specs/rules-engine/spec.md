## ADDED Requirements

### Requirement: Victory target
Every game SHALL have a victory target, an integer from 8 to 15 chosen at creation. A config without a target SHALL use 10. A target outside 8–15 SHALL be rejected. The target SHALL be part of every player's view.

#### Scenario: Default target
- **WHEN** a game is created without a victory target
- **THEN** its target is 10

#### Scenario: Out-of-range target
- **WHEN** a game is created with a victory target of 20
- **THEN** creation fails

## MODIFIED Requirements

### Requirement: Game creation
Creating a game SHALL take a seed, a player count from 3 to 6, a board mode and an optional victory target. With 3 or 4 players, beginner mode SHALL use the fixed beginner board and variable mode a seeded variable board, and the bank SHALL hold 19 of each resource and the 25-card development deck (14 Knight, 2 Road Building, 2 Year of Plenty, 2 Monopoly, 5 VP). With 5 or 6 players, the game SHALL use a seeded large board, the bank SHALL hold 24 of each resource and the 34-card development deck (20 Knight, 3 Road Building, 3 Year of Plenty, 3 Monopoly, 5 VP), and beginner mode SHALL be rejected. Each player SHALL start with 15 roads, 5 settlements, 4 cities, no cards and 0 VP. The deck SHALL be shuffled, the robber SHALL be on a desert, and Longest Road and Largest Army SHALL be unowned. Player counts other than 3 to 6 SHALL be rejected.

#### Scenario: Initial components
- **WHEN** a 3-player variable game is created
- **THEN** the bank holds 95 cards, the deck holds 25 cards with the listed composition, and each player has 15/5/4 pieces

#### Scenario: Initial components with six players
- **WHEN** a 6-player variable game is created
- **THEN** the board is a large board, the bank holds 120 cards, the deck holds 34 cards with the listed composition, and each of the 6 players has 15/5/4 pieces

#### Scenario: No beginner board for five players
- **WHEN** a 5-player beginner game is created
- **THEN** creation fails

### Requirement: Turn structure
On a normal turn the active player SHALL roll exactly once before trading, building or buying, and SHALL NOT end the turn before rolling. Trading and building SHALL then be interleaved freely. Development cards SHALL be playable before or after the roll. Ending the turn SHALL reset the per-turn flags and pass play to the next seat clockwise; in 5–6 player games a Special Building Phase SHALL come first, before the next seat's turn starts.

#### Scenario: Building before rolling is rejected
- **WHEN** the active player builds a road before rolling
- **THEN** the action fails with `must_roll_first`

#### Scenario: Rolling twice is rejected
- **WHEN** the active player rolls a second time in a turn
- **THEN** the action fails with `already_rolled`

#### Scenario: Six-player end of turn
- **WHEN** seat 5 ends their turn in a 6-player game
- **THEN** the Special Building Phase starts with seat 0's window

### Requirement: Victory point cards
VP cards SHALL be hidden and count only when revealed. A player SHALL be able to reveal them only on their own turn, only when the revealed total brings them to the victory target or more, including on the turn they were bought. The engine SHALL track hidden VP separately from public VP.

#### Scenario: Reveal to win
- **WHEN** a player with 9 public VP and 1 VP card reveals on their turn in a game with target 10
- **THEN** they win with 10 VP

#### Scenario: Reveal below 10 is rejected
- **WHEN** a player with 7 public VP and 1 VP card tries to reveal in a game with target 10
- **THEN** the action fails with `cannot_reveal`

#### Scenario: Reveal with a higher target
- **WHEN** a player with 11 public VP and 1 VP card tries to reveal in a game with target 13
- **THEN** the action fails with `cannot_reveal`

### Requirement: Victory
The game SHALL end immediately when the active player has the victory target or more VP during their own turn, checked after every state change. A player who reaches the target during another player's turn (including a Special Building Phase window) SHALL not win then, and SHALL win at the start of their own next turn if they still have the target. After the game ends, every action SHALL be rejected.

#### Scenario: Win on own turn
- **WHEN** the active player with 9 VP builds a settlement in a game with target 10
- **THEN** the game ends with them as winner

#### Scenario: Not on another player's turn
- **WHEN** a player reaches the target through a Longest Road transfer during another player's turn
- **THEN** the game continues until their own turn starts

#### Scenario: Custom target
- **WHEN** the active player reaches 10 VP in a game with target 12
- **THEN** the game continues

### Requirement: Legal-move generation
For any state and seat, the engine SHALL list every legal action the seat may take now: setup placements, rolling, discard obligation, robber hexes with their victims, road paths, settlement intersections, city targets, whether a development card can be bought, playable development cards, maritime rates, whether VP cards can be revealed, trade actions, ending the turn, and during a Special Building Phase window the builds, purchase and pass open to that seat. Every listed move SHALL be accepted by the reducer.

#### Scenario: Listed moves are accepted
- **WHEN** a random legal action from the list is applied at each step of a seeded game
- **THEN** the reducer never returns an error

#### Scenario: Listed moves in six-player games
- **WHEN** a random legal action from the list is applied at each step of a seeded 6-player game until it ends
- **THEN** the reducer never returns an error and the game passes through Special Building Phase windows
