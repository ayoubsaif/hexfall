## MODIFIED Requirements

### Requirement: Paused screen
While the room status is `paused`, every player SHALL see a full-screen notice above the board stating that the host paused the game, that it is saved until a given date (pause time + 7 days, in the viewer's language and locale), and that they can close the tab and continue later from the start screen. The board SHALL stay visible behind it and the game controls SHALL be disabled. The host's notice SHALL include a "Resume game" button that sends `resumeGame`. The notice SHALL be announced to screen readers when it appears.

The notice's actions SHALL be stacked vertically, one full-width button per row, each showing a painted gold icon, its label and a one-line hint. The rows SHALL appear in this order: "Resume game" (host only, primary style, `resume` icon), "End game" (host only, `end-game` icon), "Play another game" (every player, `home` icon), "Leave game" (every player, `leave` icon).

"Play another game" SHALL return the player to the start screen while keeping their seat: the seat SHALL stay saved on the device, the room SHALL NOT be resumed automatically on the next connection, and the paused game SHALL appear in the saved games list so the player can continue it later. The room, the seat and the other players SHALL be unaffected. Every action button SHALL lie entirely inside the dialog and be pressable, in every supported language, from a 320 px wide viewport upward.

#### Scenario: Player sees the pause
- **WHEN** the host pauses the game
- **THEN** every other player sees "Paused by the host" with the expiry date, "Play another game" and "Leave game" rows and no Resume button

#### Scenario: Host resumes from the notice
- **WHEN** the host presses "Resume game"
- **THEN** `resumeGame` is sent, and when the playing room state arrives the notice closes for everyone

#### Scenario: Host sees four stacked actions
- **WHEN** the host views the paused notice
- **THEN** it shows "Resume game", "End game", "Play another game" and "Leave game" as four full-width rows in that order, each with its icon and hint

#### Scenario: Play another game while paused
- **WHEN** a player presses "Play another game" on the paused notice
- **THEN** they see the start screen with no seat held by this connection, the paused room is listed in their saved games, and they can create, join or practise another game

#### Scenario: Continue the paused game later
- **WHEN** that player later presses "Continue" on the paused room in their saved games
- **THEN** they resume the same seat and see the paused notice again

#### Scenario: Long labels stay reachable
- **WHEN** the host views the paused notice in Spanish on a 320 px wide viewport
- **THEN** every action button, including "Salir de la partida", is fully inside the dialog and can be pressed
