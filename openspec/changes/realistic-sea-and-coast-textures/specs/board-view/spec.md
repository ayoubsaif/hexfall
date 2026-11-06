## MODIFIED Requirements

### Requirement: Sea frame

The island SHALL be surrounded by a ring of 18 sea cells adjacent to the outer land hexes, so every coastal path borders the sea. The sea SHALL be drawn as one continuous textured water surface with a shaded coast band (see the `sea-coast-rendering` capability), not as 18 separately drawn flat tiles over a sea-colored background. The ring remains the geometric frame that places harbor markers and defines coastal paths.

#### Scenario: Sea ring
- **WHEN** a board is rendered
- **THEN** 18 sea cells surround the island and every coastal path lies between a land tile and the water surface

#### Scenario: Continuous water
- **WHEN** a board is rendered
- **THEN** the sea shows no visible borders between ring cells

### Requirement: Board framing

The default camera SHALL frame the whole island including the sea ring and harbor markers when the page loads, at common desktop and mobile aspect ratios. The user SHALL be able to orbit and zoom within limits that keep the board in view and never look from below the board plane. The orbit target SHALL NOT be pannable more than 4 hex radii from the island centre, and the camera SHALL NOT drop below 30° elevation, so the horizon, the edge of the sea surface and empty space around the island never come into view.

#### Scenario: Whole board visible at load
- **WHEN** the client loads at a 16:9 or a 9:16 viewport
- **THEN** all 19 land tiles and all 9 harbor markers are inside the view

#### Scenario: Pan limit
- **WHEN** the user pans the view far from the island
- **THEN** the orbit target stops at 4 hex radii from the island centre and the island stays in view

#### Scenario: No horizon
- **WHEN** the user orbits to the lowest allowed angle at the farthest zoom
- **THEN** the camera is at least 30° above the board plane and no horizon or sea-plane edge is visible
