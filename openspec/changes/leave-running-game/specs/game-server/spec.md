## MODIFIED Requirements

### Requirement: Joining and leaving the lobby
While a room is in the lobby, a client SHALL be able to join with the room code and a name, and SHALL get the next free seat in join order plus a seat token. A room SHALL hold at most 4 seats, human or bot. Joining a full room SHALL fail with `room_full`, and an unknown code SHALL fail with `room_not_found`. Joining after the game started SHALL take over an open seat when one exists (specs `leave-game` "Take over an open seat") and SHALL otherwise fail with `game_started`. A player SHALL be able to leave in the lobby. The remaining seats SHALL then close up in join order, and if the host left, the first remaining human SHALL become host. A room whose last human leaves SHALL be deleted, even if bots remain. Leaving after the start SHALL follow specs `leave-game` "Leave a running game". Every change SHALL be sent to everyone in the room.

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

#### Scenario: Join a started game without an open seat
- **WHEN** someone joins a playing room that has no open seat
- **THEN** the join fails with `game_started`

### Requirement: Starting a game
Only the host SHALL be able to start, and only in the lobby (`not_host` otherwise). With fewer than 3 seats the server SHALL first add bots until there are 3; with 3 or 4 seats it SHALL start as is. The start SHALL choose the board mode (beginner or variable) and optionally a starting seat. The server SHALL create the game with a fresh unpredictable seed and the final seat count. After the start, the number and order of seats SHALL be fixed for the rest of the room's life; who holds a seat SHALL change only when a player leaves the running game and when someone takes over an open seat (specs `leave-game`).

#### Scenario: Start with three players
- **WHEN** the host of a 3-player lobby starts a variable game with no starting seat
- **THEN** every player receives their game view in the roll-for-order phase

#### Scenario: Too few players are filled
- **WHEN** the host of a 2-player lobby starts
- **THEN** one bot is added and the game starts with 3 players

#### Scenario: Seat count stays after a leave
- **WHEN** a player leaves a running 4-player game
- **THEN** the game still has 4 seats in the same order
