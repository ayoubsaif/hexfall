## ADDED Requirements

### Requirement: Dice on the board
The board scene SHALL show two 3D dice on a dice area of the table beside the island, at the front-right as seen from the default camera. The dice area SHALL be outside every land hex and harbor marker and inside the default board framing at 16:9 and 9:16 viewports. Each die SHALL be a rounded cube with an edge of 0.30 hex-circumradius units, drawn with the `dice.die` asset (a red body with white pips) and casting shadows. The dice SHALL show the latest roll of the current turn, including rolls for order. Before any roll in the current turn they SHALL rest in the dice area showing the previous roll, or 1 and 1 when there is none.

#### Scenario: Dice visible at load
- **WHEN** the game view loads at a 16:9 or a 9:16 viewport
- **THEN** both dice and the whole island are inside the default view, and no die covers a land hex or harbor marker

#### Scenario: Resting before the roll
- **WHEN** a new turn starts and the previous turn's roll was 2 and 5
- **THEN** the dice rest in the dice area showing 2 and 5 until the new roll

### Requirement: Physics throw
When a new roll should animate (see "When the dice animate"), the client SHALL throw both dice into the dice area with a rigid-body physics simulation: the dice SHALL fly in from an edge of the area, hit the table, bounce and tumble, collide with each other and with invisible walls around the area, and come to rest flat on the table. The dice SHALL NOT collide with tiles, pieces or the robber, and SHALL never leave the dice area. The whole throw SHALL take no more than 4 seconds from the roll arriving to the dice resting.

#### Scenario: A thrown roll
- **WHEN** seat 0 rolls 3 and 4 during play
- **THEN** every player sees both dice tumble and bounce in the dice area and come to rest flat within 4 seconds

### Requirement: Dice land on the server's roll
The value facing up on each die at rest SHALL always equal the value rolled by the server for that die, in the same order (first die, second die), for every throw, snapshot and fallback. The client SHALL NOT choose, alter or re-roll dice values; it SHALL only take them from the game log. The die SHALL NOT visibly turn or jump at the end of the throw to show the value: the face that lands up SHALL already carry the rolled value for the whole throw.

#### Scenario: Every value pair
- **WHEN** a throw is simulated for each of the 36 value pairs over many seeds
- **THEN** in every case each die rests with the server's value facing up

#### Scenario: No end snap
- **WHEN** the dice are thrown for a roll of 6 and 1
- **THEN** the orientation of each die's model relative to its physics body does not change during the throw

### Requirement: Shared throw
The throw SHALL be derived only from the room code, the roll's position in the game log and the die index, so that every client running the same browser engine shows the same tumble for the same roll. No new message or field SHALL be needed. Clients on different engines MAY show slightly different tumbles but SHALL show the same values.

#### Scenario: Same tumble for two players
- **WHEN** two players on the same browser engine watch the same roll
- **THEN** their dice follow the same path and land in the same places

#### Scenario: Deterministic simulation
- **WHEN** the throw for the same room, roll index and values is simulated twice
- **THEN** both recordings are identical

### Requirement: When the dice animate
The dice SHALL play a physics throw only for a new roll that arrives as an incremental update, once per roll. A roll that arrives in a snapshot (join, resume, reconnect) SHALL show the dice already at rest on its values with no throw, and so SHALL every roll while the user's system prefers reduced motion. The dice SHALL also show at rest, with the correct values, while the physics code is loading, when it fails to load, and when the simulation fails to settle.

#### Scenario: Resume shows the result without a throw
- **WHEN** the viewer reconnects mid-turn after a roll of 5 and 2
- **THEN** the dice show 5 and 2 at rest immediately with no throw

#### Scenario: Reduced motion
- **WHEN** the user's system prefers reduced motion and a roll of 6 and 6 arrives
- **THEN** the dice show 6 and 6 at rest immediately with no tumble or bounce

#### Scenario: One throw per roll
- **WHEN** the game state is updated again during the same turn after the roll
- **THEN** the dice do not throw again

### Requirement: Unsettled throws
If a simulated die has not come to rest after 4 seconds of simulated time, or rests more than 15° from flat, the client SHALL retry the simulation with a different seed derived from the same inputs and the attempt number, up to 4 attempts, before any frame of the throw is shown. If no attempt settles, the dice SHALL show at rest on the rolled values with no throw.

#### Scenario: Leaning die
- **WHEN** the first simulated attempt leaves a die leaning on a wall
- **THEN** the client shows a later attempt in which both dice rest flat, or the static display

### Requirement: Dice tray readout
The HUD dice tray SHALL remain the roll control, with its placement, accessible names ("Roll dice", "Roll for order"), highlight and send-once behavior unchanged. It SHALL no longer draw its own dice; it SHALL show the total of the latest roll, in the warning color for 7, and nothing before the first roll of the turn. The latest roll SHALL be available as text, for example "Rolled 3 and 4, total 7", and SHALL be announced once the 3D dice come to rest (immediately for a static display). Since the dice now roll on the board, the your-turn focus (which dims the board) SHALL close as soon as the viewer's own roll arrives, so the throw is seen undimmed.

#### Scenario: Announced on rest
- **WHEN** a roll of 3 and 4 is thrown
- **THEN** "Rolled 3 and 4, total 7" is announced when the dice come to rest, not before

#### Scenario: Focus closes before the throw
- **WHEN** the your-turn focus is open and the viewer's roll of 2 and 2 arrives
- **THEN** the focus closes at once and the dice are thrown on the undimmed board

#### Scenario: Seven in warning color
- **WHEN** the latest roll totals 7
- **THEN** the tray's total is shown in the warning color

### Requirement: Physics loaded on demand
The physics library and the dice simulation SHALL NOT be part of the code loaded for the start screen. They SHALL load when the game view mounts.

#### Scenario: Start screen bundle
- **WHEN** the client is built for production
- **THEN** the physics library is in a separate chunk that the start screen does not request
