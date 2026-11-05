## Purpose

Define how the client draws a board value: flat painted tiles in a sea frame, number tokens, harbor markers and the 3D robber. Every element is placed from the engine's board geometry and resolved through the theme layer.

## ADDED Requirements

### Requirement: Board rendering from a board value

The client SHALL render a board from a board value alone (terrains, tokens, harbors and robber hex). It SHALL place every element using the engine's board geometry and MUST NOT duplicate the coordinate math. Each land hex SHALL render the flat asset for its terrain key (`tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains` or `tile.desert`) at its hex center. Rendering a different board value SHALL change only the elements that differ.

#### Scenario: All 19 land hexes are drawn
- **WHEN** the beginner board is rendered
- **THEN** 19 land tiles are drawn, each at its hex center with the asset key of its terrain

#### Scenario: Board changes with the value
- **WHEN** the rendered board value is replaced by a variable board
- **THEN** the drawn terrains, tokens and harbors match the new board

### Requirement: Flat tiles and 3D pieces

In the flat board style (see "Board style preference"), land tiles, sea tiles, number tokens and harbor markers SHALL be drawn flat on the board plane, with no raised 3D props. Only roads, settlements, cities and the robber SHALL be drawn as 3D objects standing on the board. In both styles, adjacent tiles SHALL meet edge to edge, with no gaps or overlaps visible from the default camera.

#### Scenario: Robber is the only 3D element of a bare board
- **WHEN** a board with no player pieces is rendered in the flat style
- **THEN** the robber is the only object rising above the board plane

### Requirement: Board style preference

The client SHALL offer two board styles:
- **Flat**: painted images on flat shapes, as described in "Flat tiles and 3D pieces".
- **3D**: tiles, sea, tokens and harbors use the 3D procedural diorama representations.

Pieces and the robber SHALL render the same way in both styles. Every element SHALL keep the same position and footprint in both styles. Token numbers, pips and harbor labels SHALL stay readable in both.

When no preference is stored, the default SHALL be:
- Flat when the device has a coarse pointer (touch) or the viewport's smaller side is below 768 CSS pixels.
- 3D otherwise.

The user SHALL be able to switch styles at any time from a settings control in the HUD. The switch SHALL apply immediately, without a page reload and without losing game state. The chosen style SHALL be stored on the device and restored on the next visit. If device storage is unavailable, the client SHALL use the default without error.

#### Scenario: Default on a phone
- **WHEN** the client first loads on a touch device with a 390×844 viewport and no stored preference
- **THEN** the board renders in the flat style

#### Scenario: Default on a desktop
- **WHEN** the client first loads with a mouse and a 1920×1080 viewport and no stored preference
- **THEN** the board renders in the 3D style

#### Scenario: Switching applies immediately and persists
- **WHEN** the user switches from flat to 3D in the HUD settings and later reloads the page
- **THEN** the board changes to 3D without a reload
- **AND** after the reload the board is still 3D

#### Scenario: Storage unavailable
- **WHEN** device storage throws on access
- **THEN** the default style is used and no error is shown

### Requirement: Sea frame

The island SHALL be surrounded by a ring of 18 flat sea tiles (asset key `sea`) adjacent to the outer land hexes, over a sea-colored background. That way every coastal path borders the sea visually.

#### Scenario: Sea ring
- **WHEN** a board is rendered
- **THEN** 18 sea tiles surround the island and every coastal path lies between a land tile and a sea tile

### Requirement: Number tokens

Every land hex with a token SHALL show a flat round token (asset key `token`) at its center. The token SHALL show the token value and a row of probability pips equal to the number of dice combinations for that value (2 and 12: 1 pip; 3 and 11: 2; 4 and 10: 3; 5 and 9: 4; 6 and 8: 5). The values 6 and 8 SHALL be shown in a red emphasis color that differs from the other values. The desert SHALL show no token. The number and pips SHALL be drawn by the client over the token asset, so they stay correct and readable whatever the theme art.

#### Scenario: Token shows value and pips
- **WHEN** a hex with token 9 is rendered
- **THEN** its token shows "9" and 4 pips in the normal color

#### Scenario: Red numbers
- **WHEN** hexes with tokens 6 and 8 are rendered
- **THEN** their numbers and pips use the red emphasis color

#### Scenario: Desert has no token
- **WHEN** the desert hex is rendered
- **THEN** no token is drawn on it

### Requirement: Harbor markers

Each of the 9 harbor slots SHALL show a flat harbor marker (asset key `harbor.generic` or `harbor.<resource>` by its harbor type). The marker sits on the sea side of its slot path, offset along the path's outward direction. It SHALL have two visible links to the slot's two intersections, showing which settlement spots use the harbor. The marker SHALL show its trade rate ("3:1" for generic, "2:1" for special harbors). Special harbors SHALL also identify their resource. All six harbor types SHALL be distinguishable from one another.

#### Scenario: Harbor at its slot
- **WHEN** the beginner board is rendered
- **THEN** slot 1 shows a grain harbor marker labeled "2:1" outside its slot path, linked to that path's two intersections

#### Scenario: Generic harbor label
- **WHEN** a generic harbor is rendered
- **THEN** its marker shows "3:1"

### Requirement: Robber placement

The robber (asset key `piece.robber`) SHALL be drawn as a 3D piece on the hex given by the board's robber hex. When it is on a hex with a token, it SHALL stand beside the token rather than covering it.

#### Scenario: Robber starts on the desert
- **WHEN** the beginner board is rendered
- **THEN** the robber stands on the desert hex

### Requirement: Raised isometric island

When the board style is flat and any terrain key resolves to an isometric image, land tiles SHALL render as prisms. Each prism's top face stays at the board plane and shows the image's top face, and its sides show the earth band. The prism height SHALL be the one at which the 64 px band matches at 60°. The sea and harbor markers SHALL be lowered by the prism height. The camera SHALL start at a 60° elevation and turn at most 25° either way around the vertical axis. Otherwise the board SHALL render flat with unlimited turning.

#### Scenario: Isometric theme raises the island
- **WHEN** the flat style is active and `tile.forest` is isometric
- **THEN** land tiles render as raised prisms, the sea sits below them, and the camera starts at 60° elevation

#### Scenario: Top-down theme stays flat
- **WHEN** the flat style is active and every terrain image is top-down, or the 3D style is active
- **THEN** no prism sides render and the sea is at the board plane

### Requirement: Board framing

The default camera SHALL frame the whole island including the sea ring and harbor markers when the page loads, at common desktop and mobile aspect ratios. The user SHALL be able to orbit and zoom within limits that keep the board in view and never look from below the board plane.

#### Scenario: Whole board visible at load
- **WHEN** the client loads at a 16:9 or a 9:16 viewport
- **THEN** all 19 land tiles and all 9 harbor markers are inside the view

### Requirement: Preview board

Until games are delivered by the server, the client SHALL render the beginner board as a preview in place of the former debug scene. The preview MUST NOT include player pieces at invented positions.

#### Scenario: Preview on load
- **WHEN** the client loads with no game in progress
- **THEN** the beginner board is rendered with the robber on the desert and no player pieces
