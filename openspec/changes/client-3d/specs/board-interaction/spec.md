## Purpose

The live game on the board: drawing the board, every player's pieces and the robber from the server's view, highlighting and picking legal targets, and the light motion that makes changes easy to follow.

## ADDED Requirements

### Requirement: Live board from the game view
When a game view is present, the board SHALL be drawn from the view's board instead of the preview. Each road SHALL be drawn on its path, and each settlement and city on its intersection, in the owner's seat color, using the `piece.road`, `piece.settlement` and `piece.city` assets. The robber SHALL be drawn on the view's robber hex. This SHALL work in both Flat and 3D board styles. Leaving the game SHALL return to the preview board.

#### Scenario: Pieces after setup
- **WHEN** a view arrives with 8 settlements and 8 roads owned by 4 seats
- **THEN** 8 settlements and 8 roads are drawn at their intersections and paths, each in its owner's color

#### Scenario: City replaces settlement
- **WHEN** a view shows a city where a settlement was before
- **THEN** the city is drawn on that intersection and the settlement is gone

#### Scenario: Variable board
- **WHEN** a variable-mode game starts
- **THEN** the board shows that game's terrains, numbers and harbors, not the beginner preview

### Requirement: Seat colors
Each seat SHALL have a fixed, distinct color (seat 0 to 3), used for its pieces, its player panel and its lobby entry. The colors SHALL be distinguishable from each other and from the terrain and sea, including for common color-vision deficiencies. Seat colors SHALL NOT depend on the viewer.

#### Scenario: Same colors for everyone
- **WHEN** seats 0 and 2 look at the same road owned by seat 1
- **THEN** both see it in seat 1's color

### Requirement: Legal target highlights
The board SHALL highlight only targets listed in the viewer's legal moves for the current pick, and nothing when the viewer has no pick. The picks SHALL be: intersections for `placeSettlement` and `buildSettlement`, paths for `placeRoad` and `buildRoad`, own settlements for `buildCity`, and hexes for `moveRobber`. During setup and the robber move, the pick SHALL be active as soon as it is legal. Paid builds (road, settlement, city) SHALL become active when the player chooses that build in the HUD, and SHALL end when the player cancels or the build is sent. During Road Building, the road pick SHALL be active for each free road. Hovering a highlighted target SHALL emphasize it. Targets that are not legal SHALL NOT react to the pointer.

#### Scenario: Setup settlement
- **WHEN** the viewer must place a setup settlement
- **THEN** exactly the intersections in `placeSettlement` are highlighted

#### Scenario: Not your turn
- **WHEN** another seat is placing their setup road
- **THEN** no targets are highlighted for the viewer

#### Scenario: Paid road
- **WHEN** the active player chooses Build road in the HUD
- **THEN** exactly the paths in `buildRoad` are highlighted until the player picks one or cancels

### Requirement: Picking sends one action
Clicking or tapping a highlighted target SHALL send exactly one game action for the current pick: `placeSettlement` or `buildSettlement` with the vertex, `placeRoad` or `buildRoad` with the edge, `buildCity` with the vertex, or `moveRobber` with the hex and victim. The pick SHALL end once the action is sent. Picking SHALL work with mouse and touch. A drag that moves the camera SHALL NOT count as a pick.

#### Scenario: Build a settlement
- **WHEN** the player in a Build settlement pick clicks a highlighted intersection
- **THEN** the client sends `buildSettlement` with that vertex and the highlights go away

#### Scenario: Camera drag
- **WHEN** the player drags across a highlighted intersection to turn the camera
- **THEN** no action is sent

### Requirement: Robber move and victim choice
When the viewer must move the robber, the board SHALL highlight every hex in `moveRobber` (the current robber hex is not listed). If the chosen hex has no possible victims, the client SHALL send `moveRobber` with victim null right away. If it has one possible victim, the client SHALL send it with that victim. If it has several, the client SHALL ask the player to choose one of them, showing each candidate's name, color and hand size, and SHALL send the action after the choice. The player SHALL be able to cancel the victim choice and pick another hex.

#### Scenario: Two victims
- **WHEN** the player picks a hex where seats 1 and 3 have buildings
- **THEN** the client asks the player to choose seat 1 or seat 3 and sends `moveRobber` with the chosen victim

#### Scenario: No victims
- **WHEN** the player picks a hex with no opponent buildings
- **THEN** the client sends `moveRobber` with victim null

### Requirement: Board motion
A newly built piece SHALL drop into place with a short animation (at most 400 ms). The robber SHALL move to its new hex with a short tween (at most 600 ms). Hexes that produced on the latest roll SHALL glow briefly. A snapshot (join, resume) SHALL show the board as it is, with no animation. When the user prefers reduced motion, all of these SHALL be replaced by instant changes.

#### Scenario: Reduced motion
- **WHEN** the browser reports `prefers-reduced-motion: reduce` and a road is built
- **THEN** the road appears in place with no animation

#### Scenario: Resume shows no replay
- **WHEN** the client resumes into a game with 30 pieces on the board
- **THEN** all pieces appear in place without drop animations
