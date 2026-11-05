## REMOVED Requirements

### Requirement: Board style preference
**Reason**: The 3D diorama style is dropped; the board has a single look built from the theme images.
**Migration**: No user action. The HUD no longer shows a Flat/3D switch. A stored `hexfall.boardStyle` value is ignored.

## MODIFIED Requirements

### Requirement: Flat tiles and 3D pieces

Land tiles, sea tiles and harbor markers SHALL be drawn flat on the board plane, with no raised 3D props. Number tokens SHALL be drawn as thin chips (see "Number tokens"). Roads, settlements, cities and the robber SHALL be drawn as 3D objects standing on the board. Adjacent tiles SHALL meet edge to edge, with no gaps or overlaps visible from the default camera.

#### Scenario: Only chips and the robber rise on a bare board
- **WHEN** a board with no player pieces is rendered
- **THEN** the robber is the only object rising more than the chip thickness above the board plane

### Requirement: Number tokens

Every land hex with a token SHALL show a thin round chip (asset key `token`) at its center: a low disc with a visible edge, resting on the tile, no thicker than 0.05 hex radii. The chip's top face SHALL show the token value and a row of probability pips equal to the number of dice combinations for that value (2 and 12: 1 pip; 3 and 11: 2; 4 and 10: 3; 5 and 9: 4; 6 and 8: 5). The values 6 and 8 SHALL be shown in a red emphasis color that differs from the other values. The desert SHALL show no token. The number and pips SHALL be drawn by the client over the token asset, so they stay correct and readable whatever the theme art.

The chip SHALL stay flat on the tile and SHALL turn only around the vertical axis so that the number's baseline faces the camera: the number reads upright from the viewer's side at every orbit angle. All chips SHALL turn by the same angle, taken from the camera's horizontal viewing direction, and SHALL follow the camera as it orbits. Turning SHALL NOT move a chip's center.

#### Scenario: Token shows value and pips
- **WHEN** a hex with token 9 is rendered
- **THEN** its chip shows "9" and 4 pips in the normal color

#### Scenario: Red numbers
- **WHEN** hexes with tokens 6 and 8 are rendered
- **THEN** their numbers and pips use the red emphasis color

#### Scenario: Desert has no token
- **WHEN** the desert hex is rendered
- **THEN** no chip is drawn on it

#### Scenario: Thin chip
- **WHEN** any token is rendered
- **THEN** its chip rises above the tile by more than zero and at most 0.05 hex radii, and its edge is visible from the default camera

#### Scenario: Readable from the default view
- **WHEN** the camera is at its default position south of the board
- **THEN** every chip's number is upright on screen

#### Scenario: Readable after orbiting
- **WHEN** the user orbits the camera 90° and then 180° around the board
- **THEN** after each turn every chip's number is upright on screen, and no chip has moved from its hex center

### Requirement: Harbor markers

Each of the 9 harbor slots SHALL show a flat harbor marker (asset key `harbor.generic` or `harbor.<resource>` by its harbor type). The marker sits on the sea side of its slot path, offset along the path's outward direction. It SHALL have two visible links to the slot's two intersections, showing which settlement spots use the harbor. The marker SHALL show its badge image (or its procedural fallback when the theme maps no image) and its trade rate ("3:1" for generic, "2:1" for special harbors) as small text that does not cover the center of the image. The marker SHALL NOT draw a type icon over the badge. Special harbors SHALL be identified by their badge image, and all six harbor types SHALL stay distinguishable by badge image or fallback color.

#### Scenario: Harbor at its slot
- **WHEN** the beginner board is rendered
- **THEN** slot 1 shows the grain harbor badge image labeled "2:1" outside its slot path, linked to that path's two intersections

#### Scenario: Generic harbor label
- **WHEN** a generic harbor is rendered
- **THEN** its marker shows "3:1"

#### Scenario: No icon over the image
- **WHEN** any harbor marker is rendered
- **THEN** only the badge image and the rate are drawn on it, with no line icon

### Requirement: Raised isometric island

When any terrain key resolves to an isometric image, land tiles SHALL render as prisms. Each prism's top face stays at the board plane and shows the image's top face, and its sides show the earth band. The prism height SHALL be the one at which the 64 px band matches at 60°. The sea and harbor markers SHALL be lowered by the prism height. The camera SHALL start at a 60° elevation and turn at most 25° either way around the vertical axis. Otherwise the board SHALL render flat with unlimited turning.

#### Scenario: Isometric theme raises the island
- **WHEN** `tile.forest` is isometric
- **THEN** land tiles render as raised prisms, the sea sits below them, and the camera starts at 60° elevation

#### Scenario: Top-down theme stays flat
- **WHEN** every terrain image is top-down
- **THEN** no prism sides render and the sea is at the board plane
