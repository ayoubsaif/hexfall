# board-dice Specification

## Purpose

Show the dice as two 3D dice thrown with rigid-body physics onto the middle of the island, hidden again 5 seconds after they rest. They always land on the server's roll, every player sees the same throw, they appear at rest under reduced motion, and snapshot rolls show no board dice. The HUD tray stays the roll control and the text readout.

## Requirements

### Requirement: Dice on the board
The board scene SHALL throw two 3D dice onto a dice area at the middle of the island: centered on the board's center, its floor on the land surface, and spanning no further than the center hex and the hexes around it, so the dice are inside the view at every allowed camera angle and zoom. There SHALL be no mat or other visible area outline. Each die SHALL be a rounded cube with an edge of 0.45 hex-circumradius units, drawn with the `dice.die` asset (a white body with black pips) and casting shadows. The dice SHALL NOT take pointer input, so hexes and pieces under them stay pickable. The dice SHALL show the latest roll of the current turn, including rolls for order. Before any roll in the current turn the board SHALL show no dice.

#### Scenario: Dice thrown in the middle
- **WHEN** a roll is thrown at a 16:9 or a 9:16 viewport, with the camera at its default view, turned to its limit, or zoomed in to its limit
- **THEN** both dice land inside the dice area at the island's center and are inside the view

#### Scenario: No dice before the roll
- **WHEN** a new turn starts and the previous turn's dice have already disappeared
- **THEN** the board shows no dice until the new roll

#### Scenario: Picks under the dice
- **WHEN** the dice rest over the center hex and the viewer must move the robber
- **THEN** clicking the center hex under a die selects that hex

### Requirement: Physics throw
When a new roll should animate (see "When the dice animate"), the client SHALL throw both dice into the dice area with a rigid-body physics simulation: the dice SHALL fly in from an edge of the area, hit the floor, bounce and tumble, collide with each other, with invisible walls around the area, and with the settlements, cities, roads, number chips and robber in or near the area, and come to rest flat on the floor. The dice SHALL never pass through a piece, and SHALL never leave the dice area. The whole throw SHALL take no more than 4 seconds from the roll arriving to the dice resting.

#### Scenario: A thrown roll
- **WHEN** seat 0 rolls 3 and 4 during play
- **THEN** every player sees both dice tumble and bounce in the middle of the island and come to rest flat within 4 seconds

#### Scenario: Dice bump into pieces
- **WHEN** a city stands on a corner of the center hex and a die rolls toward it
- **THEN** the die bounces off the city instead of passing through it

### Requirement: Dice land on the server's roll
The value facing up on each die at rest SHALL always equal the value rolled by the server for that die, in the same order (first die, second die), for every throw, snapshot and fallback. The client SHALL NOT choose, alter or re-roll dice values; it SHALL only take them from the game log. The die SHALL NOT visibly turn or jump at the end of the throw to show the value: the face that lands up SHALL already carry the rolled value for the whole throw.

#### Scenario: Every value pair
- **WHEN** a throw is simulated for each of the 36 value pairs over many seeds
- **THEN** in every case each die rests with the server's value facing up

#### Scenario: No end snap
- **WHEN** the dice are thrown for a roll of 6 and 1
- **THEN** the orientation of each die's model relative to its physics body does not change during the throw

### Requirement: Shared throw
The throw SHALL be derived only from the room code, the roll's position in the game log, the die index and the pieces on the board when the roll arrives (which every client has at that point in the log), so that every client running the same browser engine shows the same tumble for the same roll. No new message or field SHALL be needed. Clients on different engines MAY show slightly different tumbles but SHALL show the same values.

#### Scenario: Same tumble for two players
- **WHEN** two players on the same browser engine watch the same roll
- **THEN** their dice follow the same path and land in the same places

#### Scenario: Deterministic simulation
- **WHEN** the throw for the same room, roll index and values is simulated twice
- **THEN** both recordings are identical

### Requirement: When the dice animate
The dice SHALL play a physics throw only for a new roll that arrives as an incremental update, once per roll. A roll that arrives in a snapshot (join, resume, reconnect) SHALL show no dice on the board; the tray SHALL still show and announce it. While the user's system prefers reduced motion, a new roll SHALL show the dice already at rest on its values with no throw. The dice SHALL also show at rest, with the correct values, while the physics code is loading, when it fails to load, and when the simulation fails to settle.

#### Scenario: Resume shows no board dice
- **WHEN** the viewer reconnects mid-turn after a roll of 5 and 2
- **THEN** the board shows no dice and the tray shows the total 7

#### Scenario: Reduced motion
- **WHEN** the user's system prefers reduced motion and a roll of 6 and 6 arrives
- **THEN** the dice show 6 and 6 at rest immediately with no tumble or bounce

#### Scenario: One throw per roll
- **WHEN** the game state is updated again during the same turn after the roll
- **THEN** the dice do not throw again and do not reappear after hiding

### Requirement: Unsettled throws
If a simulated die has not come to rest after 4 seconds of simulated time, or rests more than 15° from flat, the client SHALL retry the simulation with a different seed derived from the same inputs and the attempt number, up to 8 attempts, before any frame of the throw is shown. If no attempt settles, the dice SHALL show at rest on the rolled values with no throw.

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

### Requirement: Dice hide after resting
Once the dice come to rest (at the end of a throw, or at once for an at-rest display), they SHALL stay at rest for 5 seconds and then disappear. When motion is allowed they SHALL fade out over 0.5 seconds; under reduced motion they SHALL disappear at once with no fade. While hidden the dice SHALL not be drawn. A new roll SHALL cancel any hold or fade in progress and show the new roll at full opacity.

#### Scenario: Fade after five seconds
- **WHEN** a thrown roll of 4 and 2 comes to rest
- **THEN** the dice stay visible and at rest for 5 seconds, then fade out over 0.5 seconds, and are no longer drawn

#### Scenario: Reduced motion hides without fade
- **WHEN** reduced motion is preferred and a roll comes to rest
- **THEN** the dice disappear 5 seconds later with no fade

#### Scenario: New roll during the fade
- **WHEN** the dice are fading and a new roll arrives
- **THEN** the fade stops and the dice are thrown for the new roll at full opacity
