## ADDED Requirements

### Requirement: Six seat colors

The client SHALL define six seat colors, one per seat 0–5: the four existing colors for seats 0–3 unchanged, plus green for seat 4 and brown for seat 5. All six SHALL be distinguishable from one another and from every terrain color on the board, and each SHALL have a translated name in English and Spanish.

#### Scenario: Sixth seat
- **WHEN** a 6-player game is rendered
- **THEN** seat 5's pieces, panel and log entries use brown, and seat 4's use green

## MODIFIED Requirements

### Requirement: Board rendering from a board value

The client SHALL render a board from a board value alone (layout, terrains, tokens, harbors and robber hex). It SHALL place every element using the engine's board geometry for that board's layout and MUST NOT duplicate the coordinate math. Each land hex SHALL render the flat asset for its terrain key (`tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains` or `tile.desert`) at its hex center. Rendering a different board value SHALL change only the elements that differ.

#### Scenario: All 19 land hexes are drawn
- **WHEN** the beginner board is rendered
- **THEN** 19 land tiles are drawn, each at its hex center with the asset key of its terrain

#### Scenario: Board changes with the value
- **WHEN** the rendered board value is replaced by a variable board
- **THEN** the drawn terrains, tokens and harbors match the new board

#### Scenario: Large board
- **WHEN** a large board is rendered
- **THEN** 30 land tiles are drawn, including two deserts, each at its hex center

### Requirement: Sea frame

The island SHALL be surrounded by a ring of flat sea tiles (asset key `sea`) adjacent to the outer land hexes, over a sea-colored background: 18 tiles for the standard board and 22 for the large board. That way every coastal path borders the sea visually. The island ground, beach and coast decoration SHALL follow the outline of the board's layout.

#### Scenario: Sea ring
- **WHEN** a board is rendered
- **THEN** 18 sea tiles surround the island and every coastal path lies between a land tile and a sea tile

#### Scenario: Large sea ring
- **WHEN** a large board is rendered
- **THEN** 22 sea tiles surround the island, and the beach and coast follow its outline with no gap or overlap with land tiles

### Requirement: Harbor markers

Each harbor slot of the board's layout (9 on the standard board, 11 on the large board) SHALL show a harbor marker for its harbor type (`generic` or one of the five resources). The marker sits on the sea side of its slot path, offset along the path's outward direction. It SHALL have two visible links to the slot's two intersections, showing which settlement spots use the harbor. The marker SHALL consist of a jetty (asset key `prop.jetty`) running out from the slot path and a boat (asset key `prop.boat`) floating on the sea surface just beyond the pier's sea end, clear of the beach. No sea SHALL show inside the boat's open hull; the hull's floor and thwarts stay visible. The marker SHALL NOT show a chip or any other flat token.

The boat's sail SHALL carry the harbor's information: the trade rate ("3:1" for generic, "2:1" for special harbors). The sail of a special harbor SHALL also show its resource icon and SHALL be tinted in that resource's colour; the generic harbor's sail SHALL keep the plain canvas colour. All six harbor types SHALL be distinguishable from one another by their sails.

The sail SHALL turn about the boat's mast, around the vertical axis, so that its labelled face points toward the viewing camera's horizontal direction. The sail and mast SHALL also lean back together, hinged at the mast's foot, by 40% of the camera's elevation angle above that foot and never more than 25°, so the label tilts up toward a camera looking down; the mast SHALL stay behind the labelled face. Both SHALL follow the camera every frame as the user orbits or zooms. The hull SHALL NOT turn or lean. The sail's turn is local to each client's view and SHALL NOT be part of the game state. When the camera is directly above the sail, the sail SHALL keep its last turn.

#### Scenario: Harbor at its slot
- **WHEN** the beginner board is rendered
- **THEN** slot 1 shows a pier outside its slot path, linked to that path's two intersections, with a boat at its sea end whose sail shows the grain icon and "2:1"

#### Scenario: Generic harbor label
- **WHEN** a generic harbor is rendered
- **THEN** its boat's sail shows "3:1" on the plain canvas colour and no resource icon

#### Scenario: No harbor chips
- **WHEN** any board is rendered
- **THEN** no harbor chip is drawn; each harbor's rate and resource appear only on its boat's sail

#### Scenario: Sail faces the viewer
- **WHEN** the user orbits the camera to any side of the island
- **THEN** every harbor sail turns about its mast so its labelled face points toward the camera, and every hull keeps its orientation

#### Scenario: Dry hull
- **WHEN** a harbor boat is viewed from any camera angle, with the sea moving
- **THEN** the inside of its hull shows its floor and thwarts and no sea surface

#### Scenario: Sail leans back toward a high camera
- **WHEN** the camera looks down on a harbor from 55° above it
- **THEN** that harbor's sail and mast lean back by 22°, and with the camera at 80° they lean back by 25°

#### Scenario: Sail turn is not shared
- **WHEN** two players view the same game from different camera angles
- **THEN** each sees the sails turned toward their own camera, and no message is sent because of the turn

#### Scenario: Fallback boat keeps the label
- **WHEN** the boat model is not mapped, still loading, or failed to load
- **THEN** each harbor shows the procedural boat with the same sail label and the same camera-facing turn

#### Scenario: Eleven harbors on the large board
- **WHEN** a large board is rendered
- **THEN** 11 harbor markers are drawn, two of them with wool sails

### Requirement: Board framing

The default camera SHALL frame the whole island of the board's layout, including the sea ring and harbor markers, with each harbor boat's hull, mast and sail, when the page loads, at common desktop and mobile aspect ratios. The user SHALL be able to orbit and zoom within limits that keep the board in view and never look from below the board plane.

#### Scenario: Whole board visible at load
- **WHEN** the client loads at a 16:9 or a 9:16 viewport
- **THEN** all 19 land tiles and all 9 harbor markers, including the top of every boat's mast and sail, are inside the view

#### Scenario: Whole large board visible
- **WHEN** a large-board game is shown at a 16:9 or a 9:16 viewport
- **THEN** all 30 land tiles and all 11 harbor markers, including every mast and sail, are inside the view

### Requirement: Preview board

The client SHALL NOT load or render the 3D board on the start screen or in the lobby; those screens SHALL show the flat map sketch instead. The 3D board SHALL start loading when the host clicks Start, or when the client receives a room that is playing, paused or ended. Until a game view arrives, the loaded scene SHALL render the beginner board as a preview. The preview MUST NOT include player pieces at invented positions.

#### Scenario: No 3D board in the lobby
- **WHEN** a player creates or joins a room and waits in the lobby
- **THEN** the 3D board is not loaded and the map sketch is shown

#### Scenario: Board loads on Start
- **WHEN** the host clicks Start
- **THEN** the 3D board starts loading, and once the game view arrives it shows the game's board with no invented pieces

#### Scenario: Preview on load
- **WHEN** the 3D board is loaded and no game view has arrived yet
- **THEN** the beginner board is rendered with the robber on the desert and no player pieces
