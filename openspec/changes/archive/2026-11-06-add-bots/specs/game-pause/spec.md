## MODIFIED Requirements

### Requirement: Nothing happens while paused
While a room is `paused`, the server SHALL refuse every game action with `game_paused` without applying it, SHALL NOT run or fire the turn timer, SHALL NOT apply timeouts, SHALL NOT make bot moves, and SHALL NOT send turn alerts or pushes. Game snapshots and updates sent while paused SHALL carry a null countdown. Players SHALL still be able to resume their seat, receive the room state and their full game view, and disconnect.

#### Scenario: Action while paused
- **WHEN** the room is paused and the active player sends `rollDice`
- **THEN** they receive `game_paused` and no update is sent to anyone

#### Scenario: Timer frozen
- **WHEN** the room has a standard timer, the host pauses with 40 s left on an action wait, and 3 hours pass
- **THEN** no timeout is applied during those 3 hours

#### Scenario: Look at a paused game
- **WHEN** a player resumes their seat in a paused room
- **THEN** they receive the room state with status `paused` and their full game view

#### Scenario: Bot waits while paused
- **WHEN** the room is paused on a bot's turn and 3 hours pass
- **THEN** the bot makes no move
