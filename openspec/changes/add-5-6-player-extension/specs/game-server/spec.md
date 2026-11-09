## ADDED Requirements

### Requirement: Victory target in the lobby
The lobby start options SHALL include the victory target, a choice from 8 to 15 with 10 selected by default, next to the board mode and turn timer. Only the host SHALL be able to change it, and the client SHALL remember the host's last choice on that device. The chosen target SHALL be sent with the start, and once the game runs every game view SHALL carry it. All text SHALL be available in English and Spanish.

#### Scenario: Host picks a shorter game
- **WHEN** the host picks 8 points and starts
- **THEN** the game's victory target is 8 and every player's view shows 8 as the target

#### Scenario: Guests do not change the target
- **WHEN** a non-host player views the lobby
- **THEN** they see no victory target control

## MODIFIED Requirements

### Requirement: Joining and leaving the lobby
While a room is in the lobby, a client SHALL be able to join with the room code and a name, and SHALL get the next free seat in join order plus a seat token. A room SHALL hold at most 6 seats, human or bot. Joining a full room SHALL fail with `room_full`, joining after the game started SHALL fail with `game_started`, and an unknown code SHALL fail with `room_not_found`. A player SHALL be able to leave in the lobby. The remaining seats SHALL then close up in join order, and if the host left, the first remaining human SHALL become host. A room whose last human leaves SHALL be deleted, even if bots remain. Every change SHALL be sent to everyone in the room.

#### Scenario: Join order
- **WHEN** Ben and then Cy join Ana's room
- **THEN** Ben is seat 1 and Cy is seat 2

#### Scenario: Room full
- **WHEN** a seventh player tries to join
- **THEN** the join fails with `room_full`

#### Scenario: Host leaves the lobby
- **WHEN** Ana (seat 0, host) leaves a lobby with Ben and Cy
- **THEN** Ben becomes seat 0 and host, and Cy becomes seat 1

#### Scenario: Last human leaves
- **WHEN** the only human leaves a lobby that has a bot
- **THEN** the room is deleted

### Requirement: Starting a game
Only the host SHALL be able to start, and only in the lobby (`not_host` otherwise). With fewer than 3 seats the server SHALL first add bots until there are 3; with 3 to 6 seats it SHALL start as is. The start SHALL choose the board mode (beginner or variable), optionally a starting seat, and optionally a victory target from 8 to 15 (10 when left out). With 5 or 6 seats the game SHALL use the large board, and a beginner-mode start SHALL be played as variable. A target outside 8–15 SHALL be refused with `bad_frame`. The server SHALL create the game with a fresh unpredictable seed, the final seat count and the target. After the start, the seats SHALL be fixed for the rest of the room's life.

#### Scenario: Start with three players
- **WHEN** the host of a 3-player lobby starts a variable game with no starting seat
- **THEN** every player receives their game view in the roll-for-order phase

#### Scenario: Too few players are filled
- **WHEN** the host of a 2-player lobby starts
- **THEN** one bot is added and the game starts with 3 players

#### Scenario: Six seats use the large board
- **WHEN** the host of a 6-seat lobby starts with a victory target of 12
- **THEN** the game has 6 players, a large board and a victory target of 12

#### Scenario: Saved game from before this change
- **WHEN** a stored game with no victory target is loaded
- **THEN** it plays with a target of 10 and its standard board
