## Purpose

Let any player leave a running game without ending it for the others: their seat stays in the game as an open seat played by a bot until someone with the room code takes it over.

## ADDED Requirements

### Requirement: Leave a running game
While the room is `playing` or `paused`, any seated human, host or not, SHALL be able to leave with `leaveRoom`. The seat SHALL NOT be removed: its color, turn position, pieces, resource cards, development cards (played and unplayed), VP and special cards SHALL stay exactly as they were, and the game state SHALL NOT change. The seat SHALL become an **open seat** played by a bot (see "Bot plays an open seat"). The leaver's seat token SHALL stop matching the seat at once, so resume and seat lookup with it SHALL behave as for a wrong token (`bad_token` / `gone`). The leaver SHALL receive `roomLeft` and their connection SHALL be unbound from the room. The change SHALL be persisted before anyone is told, and refused with `unavailable` if persisting fails. Everyone still in the room SHALL receive the new room state. A connection with no seat SHALL get `no_seat`; leaving an `ended` room SHALL fail with `not_playing`. A bot seat cannot leave.

#### Scenario: Non-host leaves mid-game
- **WHEN** Ben (seat 1, not host) leaves a 4-player game on turn 12
- **THEN** Ben receives `roomLeft`, the others see seat 1 as an open bot seat, and seat 1 keeps its buildings, cards and VP

#### Scenario: Old token no longer works
- **WHEN** Ben, after leaving, tries to resume seat 1 with his stored token
- **THEN** the resume fails with `bad_token` and his saved games list no longer shows the room

#### Scenario: Leave while paused
- **WHEN** a non-host leaves a paused game
- **THEN** their seat becomes an open seat and the room stays paused

#### Scenario: Leave after the game ended
- **WHEN** a player sends `leaveRoom` in an `ended` room
- **THEN** it fails with `not_playing` and nothing changes

#### Scenario: Store down
- **WHEN** Redis is unreachable and a player leaves a running game
- **THEN** the leave is refused with `unavailable` and the player keeps their seat

### Requirement: Host and last human leaving a running game
If the host leaves a running game, the lowest-numbered remaining human seat SHALL become host, and the new host SHALL get the host controls (pause, resume, end early). If the leaver is the last human in the room, the room SHALL be deleted instead, ending the game, even if bot seats remain.

#### Scenario: Host leaves
- **WHEN** Ana (seat 0, host) leaves a game where seats 1 (bot) and 2 (Cy) and 3 (Dee) remain
- **THEN** seat 0 becomes an open bot seat and Cy (seat 2) becomes host

#### Scenario: Last human leaves
- **WHEN** the only human leaves a game against two bots
- **THEN** the room is deleted and the leaver receives `roomLeft`

### Requirement: Bot plays an open seat
From the moment a seat becomes open, the server SHALL act for it exactly as for any bot seat (specs `bots` "Bots act for themselves"), through the normal action path, so the game never waits on the player who left. This SHALL include anything the leaver still owed: a pending discard, a robber move or steal, Road Building placements, or the rest of their turn. A trade offer the leaver had proposed SHALL be cancelled by the bot, and offers made to the seat SHALL be rejected. An open seat SHALL be reported with `bot: true`, `open: true` and connected, and SHALL get a fresh name from the bot name pool. While the room is paused the bot SHALL NOT move.

#### Scenario: Leaver owed a discard
- **WHEN** a 7 is rolled, seat 2 owes 4 cards, and seat 2's player leaves before discarding
- **THEN** the bot discards 4 cards for seat 2 and the robber step follows

#### Scenario: Leaver was the active player
- **WHEN** the active player leaves after rolling, with their trade offer still open
- **THEN** the bot cancels the offer, finishes the turn and ends it, and the next seat becomes active

#### Scenario: Leaving while paused
- **WHEN** the active player leaves a paused game
- **THEN** the bot makes no move until the host resumes

### Requirement: Take over an open seat
While the room is `playing` or `paused` and has an open seat, a client SHALL be able to join with the room code, a name and an optional avatar. The server SHALL give them the lowest-numbered open seat: the seat SHALL stop being a bot and stop being open, SHALL take the joiner's validated name (unique in the room, case-insensitive) and their avatar if free (otherwise a free one), and SHALL get a new seat token that is returned to the joiner. The game state SHALL NOT change. A bot move for that seat that was scheduled but not yet applied SHALL NOT be applied after the takeover. The joiner SHALL receive `roomJoined`, the room state, the chat history and the full game view with their legal actions; everyone else SHALL receive the new room state. With no open seat, joining a started room SHALL fail with `game_started`; joining an `ended` room SHALL fail with `game_started`. Seats that were bots from the start (added in the lobby or by auto-fill) SHALL NOT be open seats.

#### Scenario: Newcomer takes the seat
- **WHEN** Eve joins with the room code while seat 1 is the only open seat
- **THEN** Eve holds seat 1 with its buildings, cards and VP, sees her full game view, and the others see seat 1 as Eve, human and connected

#### Scenario: Takeover on the seat's turn
- **WHEN** Eve takes over seat 1 while it is seat 1's turn and the bot has not moved yet
- **THEN** the bot makes no further move and Eve has seat 1's legal actions

#### Scenario: No open seat
- **WHEN** someone joins a running 4-player game with no open seat
- **THEN** the join fails with `game_started`

#### Scenario: Auto-filled bots are not open
- **WHEN** a game was started by one human with two auto-filled bots and someone joins with the code
- **THEN** the join fails with `game_started`

#### Scenario: The leaver comes back
- **WHEN** Ben leaves and later joins the same room again with the code while his old seat is still open
- **THEN** he takes over the seat as a new joiner with a new token

### Requirement: Open seats survive a restart
Whether a seat is open, and the name and avatar of a taken-over seat, SHALL be stored with the room and restored after a server restart. Rooms stored before this change SHALL load with no open seats.

#### Scenario: Restart with an open seat
- **WHEN** seat 1 is open, the server restarts and a player resumes
- **THEN** seat 1 is still an open bot seat, the bot keeps playing it, and it can still be taken over

### Requirement: Game menu for every player
During a `playing` game, every seated human SHALL be able to open the HUD game menu; while the game is `paused`, the paused notice SHALL offer the same "Leave game" button to every player. The menu button SHALL show a **leave icon** (a door with an outward arrow, in the same painted gold style as the other HUD icons), not the pause icon; the pause icon SHALL stay only on the host's "Close game for now" item. It SHALL offer "Leave game" to everyone, and the host SHALL additionally keep "Close game for now" and "End game now" as before. "Leave game" SHALL ask for confirmation, explaining that a bot will play their seat, that they cannot come back to it with this browser's saved game, and that someone with the room code can take it over; confirming SHALL send `leaveRoom` once. The menu SHALL also show the room's invite link with a copy button. After `roomLeft` the client SHALL forget the seat token and return to the start screen. An error SHALL be shown in the menu. All text SHALL be available in English and Spanish.

#### Scenario: Non-host leaves from the menu
- **WHEN** a non-host opens the game menu, chooses "Leave game" and confirms
- **THEN** `leaveRoom` is sent once and, after `roomLeft`, the start screen is shown without that room in saved games

#### Scenario: Cancel
- **WHEN** a player chooses "Leave game" and then cancels
- **THEN** nothing is sent and the game continues

#### Scenario: Menu button icon
- **WHEN** any player looks at the game menu button during a game
- **THEN** it shows the leave icon, and the pause icon appears only next to the host's "Close game for now"

#### Scenario: Non-host menu contents
- **WHEN** a non-host opens the game menu
- **THEN** it shows "Leave game" and the invite link, and no "Close game for now" or "End game now"

### Requirement: Open seat indicator
The HUD SHALL mark an open seat's player panel with an "Open seat" badge, and the chat SHALL show a system line when a player leaves ("Ben left; a bot is playing Blue") and when a seat is taken over ("Eve took over Blue"). Neither line SHALL reveal any hidden information. All text SHALL be available in English and Spanish.

#### Scenario: Seat opens
- **WHEN** Ben leaves seat 1
- **THEN** every remaining player sees seat 1's panel with "Open seat" and a line saying Ben left and a bot is playing that color

#### Scenario: Seat taken over
- **WHEN** Eve takes over seat 1
- **THEN** the "Open seat" badge disappears and a line says Eve took over that color
