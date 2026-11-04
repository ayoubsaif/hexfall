## MODIFIED Requirements

### Requirement: Starting a game
Only the host SHALL be able to start, and only in the lobby with 3 or 4 seated players (`not_host`, `not_enough_players` otherwise). The start SHALL choose:
- the board mode (beginner or variable);
- optionally, a starting seat;
- a turn timer preset: `off`, `standard` (30 s to roll, 90 s idle) or `relaxed` (60 s to roll, 120 s idle). It SHALL default to `off` when not given.

The server SHALL create the game with a fresh unpredictable seed and the seated player count. After the start, the seats and the timer preset SHALL be fixed for the rest of the room's life.

#### Scenario: Start with three players
- **WHEN** the host of a 3-player lobby starts a variable game with no starting seat
- **THEN** every player receives their game view in the roll-for-order phase

#### Scenario: Too few players
- **WHEN** the host of a 2-player lobby starts
- **THEN** the start fails with `not_enough_players`

#### Scenario: Start with a timer
- **WHEN** the host starts with the `standard` timer
- **THEN** every player's first game view carries a 30-second roll-for-order countdown

### Requirement: Presence
The room state SHALL show each seat's name and whether it is connected, and SHALL be sent to everyone when that changes. A disconnected player SHALL keep their seat. When the room's turn timer is `off`, the game SHALL keep waiting for actions that only a disconnected player can take, and the server SHALL NOT take any action on a player's behalf. When the timer is on, the server SHALL act on a player's behalf only through the turn timer (see "Turn timer"), whether or not that player is connected.

#### Scenario: Disconnect during a discard
- **WHEN** the timer is `off` and a player who owes a discard disconnects
- **THEN** the others see them as disconnected and the game stays in the discard phase until they return and discard

#### Scenario: Disconnect during a discard with a timer
- **WHEN** the timer is `standard` and a player who owes a discard disconnects
- **THEN** the others see them as disconnected, and when the 90-second countdown runs out the server discards for them

## ADDED Requirements

### Requirement: Turn timer
When a room's timer preset is not `off`, the server SHALL keep exactly one deadline per running game:
- **roll deadline:** used while the game waits for a dice roll or a roll for order. It is 30 s under `standard` and 60 s under `relaxed`.
- **action deadline:** used for every other wait: setup placements, the main turn after the roll, discards, robber moves and Road Building. It is 90 s under `standard` and 120 s under `relaxed`.

The deadline SHALL restart after each accepted action when either of these holds:
- the action changed the phase or the active player;
- the action was taken by a seat the game was waiting for (the active player, or a seat that owes a discard).

Accepted actions by other seats, such as answering a trade offer, SHALL NOT restart it.

When the deadline passes, the server SHALL apply the engine's `timeout` action through the same path as player actions: one at a time per room, persisted before anyone is told, and broadcast as a normal update. The game SHALL then continue with a new deadline. A timeout SHALL never be applied to a stale state: if a player's action is accepted first, the timeout for the old deadline SHALL be dropped. No deadline SHALL run once the game has ended.

The deadline SHALL be persisted with the room so that it survives a server restart. When a room is rebuilt, the countdown SHALL resume from the stored deadline, and a deadline that already passed SHALL fire at once.

Every game snapshot and update SHALL include the current countdown:
- the kind (`roll` or `action`);
- the full duration;
- the milliseconds remaining when the message was sent;
- the seats being waited for.

The countdown SHALL be null when the timer is off or the game has ended. The countdown SHALL be computed from the server clock only, and SHALL NOT depend on any client's clock.

#### Scenario: Auto-roll
- **WHEN** the timer is `standard` and the active player does not roll within 30 s of their turn starting
- **THEN** the server rolls for them and every player receives an update whose log shows that time ran out and the roll

#### Scenario: Idle turn ends
- **WHEN** the timer is `standard`, the active player rolled, and then 90 s pass with no action from them
- **THEN** the server ends their turn and the next player's 30-second roll countdown starts

#### Scenario: Acting restarts the idle countdown
- **WHEN** the active player builds a road 80 s after rolling
- **THEN** the countdown restarts at 90 s from the build

#### Scenario: Other players cannot extend the turn
- **WHEN** a non-active player rejects the active player's trade offer
- **THEN** the active player's countdown keeps running from where it was

#### Scenario: Race with a player's action
- **WHEN** the active player's end-turn is accepted a moment before their deadline passes
- **THEN** no timeout is applied to the next player's turn because of the old deadline

#### Scenario: Restart keeps the countdown
- **WHEN** the server restarts 10 s into a 90-second action countdown, and the room is rebuilt 20 s after that
- **THEN** the rebuilt room's countdown has about 60 s left, and players see that remaining time

#### Scenario: Timer off
- **WHEN** the room's timer is `off`
- **THEN** every snapshot and update carries a null countdown and the server never applies `timeout`
