## MODIFIED Requirements

### Requirement: Joining and leaving the lobby
While a room is in the lobby, a client SHALL be able to join with the room code and a name, and SHALL get the next free seat in join order plus a seat token. A room SHALL hold at most 4 seats, human or bot. Joining a full room SHALL fail with `room_full`, joining after the game started SHALL fail with `game_started`, and an unknown code SHALL fail with `room_not_found`. A player SHALL be able to leave in the lobby. The remaining seats SHALL then close up in join order, and if the host left, the first remaining human SHALL become host. A room whose last human leaves SHALL be deleted, even if bots remain. Every change SHALL be sent to everyone in the room.

#### Scenario: Join order
- **WHEN** Ben and then Cy join Ana's room
- **THEN** Ben is seat 1 and Cy is seat 2

#### Scenario: Room full
- **WHEN** a fifth player tries to join
- **THEN** the join fails with `room_full`

#### Scenario: Host leaves the lobby
- **WHEN** Ana (seat 0, host) leaves a lobby with Ben and Cy
- **THEN** Ben becomes seat 0 and host, and Cy becomes seat 1

#### Scenario: Last human leaves
- **WHEN** the only human leaves a lobby that has a bot
- **THEN** the room is deleted

### Requirement: Starting a game
Only the host SHALL be able to start, and only in the lobby (`not_host` otherwise). With fewer than 3 seats the server SHALL first add bots until there are 3; with 3 or 4 seats it SHALL start as is. The start SHALL choose the board mode (beginner or variable) and optionally a starting seat. The server SHALL create the game with a fresh unpredictable seed and the final seat count. After the start, the seats SHALL be fixed for the rest of the room's life.

#### Scenario: Start with three players
- **WHEN** the host of a 3-player lobby starts a variable game with no starting seat
- **THEN** every player receives their game view in the roll-for-order phase

#### Scenario: Too few players are filled
- **WHEN** the host of a 2-player lobby starts
- **THEN** one bot is added and the game starts with 3 players

### Requirement: Presence
The room state SHALL show each seat's name, whether it is a bot, and whether it is connected, and SHALL be sent to everyone when that changes. A disconnected player SHALL keep their seat. The game SHALL keep waiting for actions that only a disconnected human can take, and the server SHALL NOT take any action on a human's behalf, except the turn-timer timeout. Bot seats are the exception: the server SHALL act for them.

#### Scenario: Disconnect during a discard
- **WHEN** a player who owes a discard disconnects
- **THEN** the others see them as disconnected and the game stays in the discard phase until they return and discard

#### Scenario: Lookup has no side effects
- **WHEN** a client looks up a playing room where the seat is held by another connection
- **THEN** that connection keeps its seat and other players see no presence change

#### Scenario: Bot never disconnected
- **WHEN** all humans disconnect from a playing room that has a bot
- **THEN** the bot is still shown connected
