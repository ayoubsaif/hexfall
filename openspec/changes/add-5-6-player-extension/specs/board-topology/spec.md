## ADDED Requirements

### Requirement: Board layouts

There SHALL be two board layouts: `standard` (the 19-hex island described in this specification) and `large` (the 30-hex island of the large-board capability). Each layout SHALL have its own static topology. Code that works with a board SHALL take the topology of that board's layout, and the standard topology SHALL stay available unchanged under its current ids.

#### Scenario: Topology by layout
- **WHEN** the topology of a large board is requested
- **THEN** it has 30 hexes and 11 harbor slots, and the standard topology still has 19 hexes and 9 harbor slots

## MODIFIED Requirements

### Requirement: Board value

A board SHALL be plain JSON data. It SHALL name its layout (`standard` or `large`); a board without a layout SHALL be read as `standard`. For each hex it gives the terrain (forest, pasture, fields, hills, mountains or desert) and the number token value (2–12 excluding 7, or none for a desert). It also gives the harbor type on each harbor slot (generic 3:1, or 2:1 brick, grain, lumber, ore or wool) and the hex the robber is on. Every standard board SHALL contain exactly 4 forest, 4 pasture, 4 fields, 3 hills, 3 mountains and 1 desert. It SHALL contain exactly the 18 token values one each of 2 and 12 and two each of 3, 4, 5, 6, 8, 9, 10 and 11, and exactly 4 generic and 5 special harbors (one of each resource). Large boards SHALL hold the counts given by the large-board capability. A desert SHALL never carry a token, and the robber SHALL start on a desert.

#### Scenario: JSON round-trip
- **WHEN** a board is serialized to JSON and parsed back
- **THEN** the result is deep-equal to the original board

#### Scenario: Component counts hold for every setup
- **WHEN** a beginner board or any variable board is created
- **THEN** its terrain, token and harbor counts match the component counts above
- **AND** the robber is on the desert, which has no token

#### Scenario: Board without a layout
- **WHEN** a stored board with no layout field is read
- **THEN** it is treated as a standard board
