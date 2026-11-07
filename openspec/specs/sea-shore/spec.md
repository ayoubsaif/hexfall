# sea-shore Specification

## Purpose
Keep the sea close to the island's hexagons with a narrow beach, and make harbor boats float on the water rather than rest on sand.

## Requirements

### Requirement: Narrow beach
The waterline (where the beach drops below sea level) SHALL lie, on average around the island, no further than 0.35 hex radius outside the outer hex edges, and nowhere further than 0.7 hex radius. The beach SHALL stay dry for at least 0.05 hex radius outside every outer hex edge, so water never reaches the land. The beach mesh and the water shader SHALL use the same profile.

#### Scenario: Water near the board
- **WHEN** the board is shown with a raised island theme
- **THEN** the waterline runs close to the outer hexagons all around the island

#### Scenario: Land stays dry
- **WHEN** any point is at most 0.05 hex radius outside an outer hex edge
- **THEN** the beach there is above sea level

### Requirement: Boats float
Each harbor boat SHALL be placed beyond its jetty's sea end, pushed further out to sea when needed, so that the water under the centre and both ends of its hull is at least a minimum depth. The placement SHALL be deterministic for the board layout.

#### Scenario: Boat at a wide stretch of beach
- **WHEN** the shore at a harbor is wider than the jetty
- **THEN** the boat sits further out, on water, not on sand

### Requirement: Boats bob
Harbor boats SHALL rise and fall gently with a slight roll, each out of phase with the others, without changing which way their sail faces. When the user prefers reduced motion, boats SHALL stay still.

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion
- **THEN** boats do not bob
