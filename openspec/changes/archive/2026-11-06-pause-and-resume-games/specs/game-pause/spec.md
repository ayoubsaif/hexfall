## ADDED Requirements

### Requirement: Host pauses a running game
The host SHALL be able to pause a game whose room status is `playing`, at any point of the game (setup, a roll wait, a discard, a robber move, Road Building or the main turn), by sending `pauseGame`. The server SHALL persist the room with status `paused` and the pause time before telling anyone, then send the new room state to every connected seat. `pauseGame` SHALL fail with `not_host` from any other seat, and with `not_playing` when the room is in the lobby, already paused, or the game has ended. A store failure SHALL be refused with `unavailable` and leave the room `playing`.

#### Scenario: Host pauses mid-turn
- **WHEN** the host sends `pauseGame` while seat 2 is in their main turn
- **THEN** every connected player receives a room state with status `paused` and the game view is unchanged

#### Scenario: Non-host tries to pause
- **WHEN** seat 1 (not the host) sends `pauseGame`
- **THEN** it receives `not_host` and the room stays `playing`

### Requirement: Nothing happens while paused
While a room is `paused`, the server SHALL refuse every game action with `game_paused` without applying it, SHALL NOT run or fire the turn timer, SHALL NOT apply timeouts, and SHALL NOT send turn alerts or pushes. Game snapshots and updates sent while paused SHALL carry a null countdown. Players SHALL still be able to resume their seat, receive the room state and their full game view, and disconnect.

#### Scenario: Action while paused
- **WHEN** the room is paused and the active player sends `rollDice`
- **THEN** they receive `game_paused` and no update is sent to anyone

#### Scenario: Timer frozen
- **WHEN** the room has a standard timer, the host pauses with 40 s left on an action wait, and 3 hours pass
- **THEN** no timeout is applied during those 3 hours

#### Scenario: Look at a paused game
- **WHEN** a player resumes their seat in a paused room
- **THEN** they receive the room state with status `paused` and their full game view

### Requirement: Host resumes
Only the host SHALL be able to resume a paused room, by sending `resumeGame`; other seats SHALL get `not_host`, and a room that is not paused SHALL answer `not_paused`. The host SHALL be able to resume whether or not other players are connected. On resume the server SHALL persist status `playing`, then send the room state and a game snapshot to every connected seat. The countdown SHALL continue with the time that was left when the game was paused. The game state SHALL equal the state at the moment of the pause.

#### Scenario: Resume with time left
- **WHEN** the host paused with 40 s left on a 90 s action wait and resumes two days later
- **THEN** every connected player's snapshot shows an action countdown with 40 s remaining

#### Scenario: Resume alone
- **WHEN** only the host is connected and sends `resumeGame`
- **THEN** the room becomes `playing` and the game waits on whichever seat it waited on before the pause

### Requirement: Pause controls in the HUD
During a `playing` game, the host's HUD SHALL offer "Close game for now". Activating it SHALL ask for confirmation, explaining that the game is saved for 7 days and only the host can resume it; confirming SHALL send `pauseGame`. Non-hosts SHALL NOT see the control.

#### Scenario: Host closes the game
- **WHEN** the host chooses "Close game for now" and confirms
- **THEN** `pauseGame` is sent once

#### Scenario: Non-host
- **WHEN** a non-host player opens the HUD menu
- **THEN** no "Close game for now" control is shown

### Requirement: Paused screen
While the room status is `paused`, every player SHALL see a full-screen notice above the board stating that the host paused the game, that it is saved until a given date (pause time + 7 days, in the viewer's language and locale), and that they can close the tab and continue later from the start screen. The board SHALL stay visible behind it and the game controls SHALL be disabled. The host's notice SHALL include a "Resume game" button that sends `resumeGame`. The notice SHALL be announced to screen readers when it appears.

#### Scenario: Player sees the pause
- **WHEN** the host pauses the game
- **THEN** every other player sees "Paused by the host" with the expiry date and no Resume button

#### Scenario: Host resumes from the notice
- **WHEN** the host presses "Resume game"
- **THEN** `resumeGame` is sent, and when the playing room state arrives the notice closes for everyone

### Requirement: Paused room expiry
A paused room SHALL expire 7 days after it was paused, removing all its stored data. Pausing SHALL set the room's expiry to 7 days; resuming SHALL restore the normal expiry rule.

#### Scenario: Forgotten paused game
- **WHEN** a game was paused 7 days and 1 minute ago and a player tries to resume their seat
- **THEN** the resume fails with `bad_token` as for any unknown room
