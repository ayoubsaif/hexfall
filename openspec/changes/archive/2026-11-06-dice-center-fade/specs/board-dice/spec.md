## MODIFIED Requirements

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
When a new roll should animate (see "When the dice animate"), the client SHALL throw both dice into the dice area with a rigid-body physics simulation: the dice SHALL fly in from an edge of the area, hit the floor, bounce and tumble, collide with each other and with invisible walls around the area, and come to rest flat on the floor. The dice SHALL NOT collide with tiles, pieces or the robber, and SHALL never leave the dice area. The whole throw SHALL take no more than 4 seconds from the roll arriving to the dice resting.

#### Scenario: A thrown roll
- **WHEN** seat 0 rolls 3 and 4 during play
- **THEN** every player sees both dice tumble and bounce in the middle of the island and come to rest flat within 4 seconds

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

## ADDED Requirements

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
