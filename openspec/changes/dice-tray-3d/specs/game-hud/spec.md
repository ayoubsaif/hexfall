## MODIFIED Requirements

### Requirement: Turn status and controls
The HUD SHALL always say what the game is waiting for and from whom, in plain words: rolling for order, placing a setup settlement or road, rolling, discarding (listing who still owes cards), moving the robber, placing free roads, or the active player's main turn. Each control SHALL be shown or enabled only when the matching legal move is present: Roll for order (`rollForOrder`), Roll dice (`rollDice`), End turn (`endTurn`), Buy development card (`buyDevCard`), Build road, settlement and city (non-empty `buildRoad`, `buildSettlement`, `buildCity`). The Roll dice and Roll for order controls SHALL be the dice tray itself (see "Dice display"); the turn bar SHALL NOT show separate roll buttons. Build and buy controls SHALL show their resource cost. A Build control SHALL start the matching board pick and offer Cancel.

#### Scenario: Before the roll
- **WHEN** it is the viewer's turn and they have not rolled
- **THEN** the dice tray is enabled as "Roll dice", and End turn and the build controls are disabled

#### Scenario: Waiting on another player
- **WHEN** seat 2 is active in the main turn
- **THEN** the HUD says it is seat 2's turn and the viewer's action controls, including the dice tray, are disabled

#### Scenario: Roll for order
- **WHEN** the viewer's legal moves include `rollForOrder`
- **THEN** the dice tray is enabled as "Roll for order", and activating it sends `rollForOrder` once

#### Scenario: No roll buttons in the turn bar
- **WHEN** the turn bar is shown in any phase
- **THEN** it contains no Roll dice or Roll for order button

### Requirement: Dice display
The HUD SHALL show two dice and their total in a dice tray placed at the bottom-right corner of the area left free for the board. The tray SHALL NOT overlap the player panels, the event log, the bottom stack or the corner controls in any layout. Each die SHALL be drawn as a three-dimensional cube with rounded edges, showing the rolled value on its front face. The single pip and the four pips SHALL be red and the other pips dark, on cream faces, and the single pip SHALL be larger than the others. The dice SHALL show the latest roll of the current turn, including rolls for order. Before any roll in the current turn they SHALL show a resting pose with no total.

When a new roll arrives as an incremental update, every player SHALL see a single throw animation: the dice tumble and bounce, then come to rest on the rolled faces. A roll that arrives in a snapshot (join, resume) SHALL show its result without the animation, and so SHALL every roll under reduced motion. A total of 7 SHALL be shown in the warning color.

The dice tray SHALL be one control with the accessible name "Roll dice" while `rollDice` is legal, and "Roll for order" while `rollForOrder` is legal. While one of those moves is legal it SHALL be visibly highlighted, without looping animation, and activating it by pointer or keyboard SHALL send that action once. Otherwise the control SHALL be disabled. The latest roll SHALL be available as text, for example "Rolled 3 and 4, total 7", and SHALL be announced once the dice come to rest.

#### Scenario: Roll shown to everyone
- **WHEN** seat 0 rolls 3 and 4
- **THEN** every player sees the dice tumble and settle on 3 and 4, with total 7

#### Scenario: Tap to roll
- **WHEN** it is the viewer's turn before the roll and they click or press Enter on the dice tray
- **THEN** the client sends `rollDice` exactly once, and the tray stays disabled until the result arrives

#### Scenario: Resume shows the result without a throw
- **WHEN** the viewer reconnects mid-turn after a roll of 5 and 2
- **THEN** the dice show 5 and 2 immediately with no animation

#### Scenario: Reduced motion
- **WHEN** the user's system prefers reduced motion and a roll of 6 and 6 arrives
- **THEN** the dice show 6 and 6 immediately with no tumble or bounce

#### Scenario: Placement on desktop
- **WHEN** the game HUD is shown at 1440 × 900 px
- **THEN** the dice tray sits above the bottom stack and to the left of the event log, at the bottom-right of the board area, and overlaps neither
