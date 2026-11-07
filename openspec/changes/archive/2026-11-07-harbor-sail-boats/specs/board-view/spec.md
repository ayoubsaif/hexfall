## MODIFIED Requirements

### Requirement: Harbor markers

Each of the 9 harbor slots SHALL show a harbor marker for its harbor type (`generic` or one of the five resources). The marker sits on the sea side of its slot path, offset along the path's outward direction. It SHALL have two visible links to the slot's two intersections, showing which settlement spots use the harbor. The marker SHALL consist of a pier running out from the slot path and a boat (asset key `prop.boat`) floating on the sea surface just beyond the pier's sea end, clear of the beach. No sea SHALL show inside the boat's open hull; the hull's floor and thwarts stay visible. The marker SHALL NOT show a chip or any other flat token.

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

### Requirement: Board framing

The default camera SHALL frame the whole island including the sea ring and harbor markers, with each harbor boat's hull, mast and sail, when the page loads, at common desktop and mobile aspect ratios. The user SHALL be able to orbit and zoom within limits that keep the board in view and never look from below the board plane.

#### Scenario: Whole board visible at load
- **WHEN** the client loads at a 16:9 or a 9:16 viewport
- **THEN** all 19 land tiles and all 9 harbor markers, including the top of every boat's mast and sail, are inside the view
