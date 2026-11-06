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

The default camera SHALL frame the whole island including the sea ring and harbor markers when the page loads, at common desktop and mobile aspect ratios. The user SHALL be able to orbit and zoom within limits that keep the board in view and never look from below the board plane. The orbit target SHALL remain fixed at the island centre; mouse, touch and touchpad input SHALL NOT pan the board, and the camera SHALL NOT drop below 30° elevation, so the horizon, the edge of the sea surface and empty space around the island never come into view.

#### Scenario: Whole board visible at load
- **WHEN** the client loads at a 16:9 or a 9:16 viewport
- **THEN** all 19 land tiles and all 9 harbor markers are inside the view

#### Scenario: Pan limit
- **WHEN** the user pans the view far from the island
- **THEN** the orbit target remains at the island centre; rotation and zoom operate around that fixed point

#### Scenario: No horizon
- **WHEN** the user orbits to the lowest allowed angle at the farthest zoom
- **THEN** the camera is at least 30° above the board plane and no horizon or sea-plane edge is visible

### Requirement: Harbor dock seating

Each wooden harbor dock SHALL align perpendicular to its own coastal path, meeting that hex edge squarely. The deck SHALL be wide enough to support the harbor chip. The chip SHALL rest directly on the deck, with no floating gap or bobbing, while its label continues to face the camera.

#### Scenario: Dock follows its coastal edge
- **WHEN** any of the nine harbors is rendered
- **THEN** its dock meets the local hex edge squarely and the chip sits flush on its deck


### Requirement: Readable paper chips

Number and harbor chips SHALL share the pale-yellow aged-paper surface of player cards, including subtle grain and gold inset edges. Their faces and labels SHALL follow camera pitch and yaw. Labels SHALL fit within the chip face. Number labels SHALL share one base font size and ink color; probability emphasis SHALL vary only font weight from light to extra bold. Existing probability pips remain visible. Tilting SHALL keep the lowest chip rim on its supporting surface.

#### Scenario: Readable orbit
- **WHEN** the player rotates or tilts the view
- **THEN** chip faces and text remain camera-facing and legible
