## ADDED Requirements

### Requirement: Host ends a game early
The host SHALL be able to end a game whose room status is `playing` or `paused`, at any point of the game, by sending `endGame`. The server SHALL compute the result, persist the room with status `ended` and the result before telling anyone, stop the turn timer, then send the new room state to every connected seat. `endGame` SHALL fail with `not_host` from any other seat, and with `not_playing` when the room is in the lobby or the game has already ended. A store failure SHALL be refused with `unavailable` and leave the room in its previous status. The game state itself SHALL NOT change: no action is added to the game log and the engine rules are not involved.

#### Scenario: Host ends mid-turn
- **WHEN** the host sends `endGame` while seat 2 is in their main turn
- **THEN** every connected player receives a room state with status `ended` and a result

#### Scenario: Host ends a paused game
- **WHEN** the room is paused and the host sends `endGame`
- **THEN** the room becomes `ended` with a result

#### Scenario: Non-host tries to end
- **WHEN** seat 1 (not the host) sends `endGame`
- **THEN** it receives `not_host` and the room status is unchanged

#### Scenario: Already ended
- **WHEN** the game ended normally (a player reached 10 VP) and the host sends `endGame`
- **THEN** it receives `not_playing`

### Requirement: Early-end winner
The early-end result SHALL list, for every seat, its total VP: public VP (buildings, Longest Road, Largest Army, revealed VP cards) plus its unrevealed VP cards. The winner SHALL be the seat with the most total VP. When several seats are tied for the most, all of them SHALL be winners. The result SHALL record the end time, the reason (`host`), the winners and every seat's total VP and hidden VP card count.

#### Scenario: Clear leader
- **WHEN** totals are seat 0: 7, seat 1: 9, seat 2: 6 and the host ends the game
- **THEN** seat 1 is the only winner

#### Scenario: Hidden VP cards count
- **WHEN** seat 0 has 8 public VP and 1 unrevealed VP card and seat 1 has 8 public VP and none
- **THEN** seat 0 wins with 9

#### Scenario: Tie shared
- **WHEN** seats 0 and 2 both have 8 total VP and nobody has more
- **THEN** seats 0 and 2 are both winners

### Requirement: Nothing happens after an early end
Once a room is ended early, the server SHALL refuse every game action with `game_over`, SHALL NOT run or fire the turn timer, and SHALL NOT send turn alerts or pushes. Players SHALL still be able to resume their seat and receive the room state with the result.

#### Scenario: Action after early end
- **WHEN** the host ended the game and a player sends `rollDice`
- **THEN** they receive `game_over` and no update is sent

### Requirement: End control in the HUD
During a `playing` game, the host's HUD menu SHALL offer "End game now" next to "Close game for now"; the host's paused notice SHALL also offer "End game". Activating either SHALL ask for confirmation, explaining that the game ends for everyone, that the player with the most VP (including hidden VP cards) wins and ties share the win, and that it cannot be undone. Confirming SHALL send `endGame` once. Non-hosts SHALL NOT see the control.

#### Scenario: Host ends from the menu
- **WHEN** the host chooses "End game now" and confirms
- **THEN** `endGame` is sent once

#### Scenario: Host cancels
- **WHEN** the host chooses "End game now" and cancels the confirmation
- **THEN** nothing is sent and the game continues

#### Scenario: Non-host menu
- **WHEN** a non-host opens the HUD menu
- **THEN** no "End game now" control is shown

### Requirement: End from the saved games list
The server SHALL accept `endSavedGame { room, token }` from any connection. When the token matches the room's host seat and the room is `playing` or `paused`, the server SHALL end the game exactly as for `endGame` (same result, storage, expiry and broadcasts to connected seats) without binding the connection to the seat or changing presence, then answer with `seatsInfo` holding that one room. A token that matches no seat, or an unknown room, SHALL be refused with `bad_token`; a non-host seat's token with `not_host`; a room in the lobby or already ended with `not_playing`. In the saved games list, each room the viewer hosts that is playing or paused SHALL offer "End game", which asks for the same confirmation as in the HUD and then sends `endSavedGame` once; the ended room then leaves the list.

#### Scenario: Host ends an abandoned game from the start screen
- **WHEN** the host sees an old playing room in "Your games", chooses "End game" and confirms
- **THEN** the room becomes `ended` with a result, connected players see the scoreboard, and the room leaves the list

#### Scenario: Not the host
- **WHEN** a player who is not the host of a listed room looks at its entry
- **THEN** no "End game" control is shown, and an `endSavedGame` with their token is refused with `not_host`

### Requirement: Early-end scoreboard
When the room status is `ended` with a result, every player SHALL see the game-over dialog marked "Ended by the host", naming every winner (one or several), with a table of every seat's total VP sorted high to low, winners in bold, and each seat's hidden VP card count shown. The dialog SHALL not be dismissable except through "Back to start", as for a normal game end. The paused notice SHALL close when the result arrives.

#### Scenario: Shared win shown
- **WHEN** the host ends the game with seats 0 and 2 tied at 8
- **THEN** every player sees "Ended by the host" and both names as winners, both rows in bold

### Requirement: Early-ended room expiry
A room ended early SHALL expire 1 day after it was ended, removing all its stored data. It SHALL be dropped from the saved games list like any ended room.

#### Scenario: Result kept one day
- **WHEN** the host ended the game 2 hours ago and a player resumes their seat
- **THEN** they see the early-end scoreboard

#### Scenario: Expired result
- **WHEN** the game was ended early 1 day and 1 minute ago and a player tries to resume their seat
- **THEN** the resume fails with `bad_token` as for any unknown room
