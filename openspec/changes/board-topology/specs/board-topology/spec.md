## Purpose

Define the island board as static, deterministic plain data: hexes, intersections, paths, the sea frame and harbor slots with their adjacency and world positions. Also define the beginner and variable board setups from AGENTS.md §4a/§4b. The rules engine, server and client all build on this.

## ADDED Requirements

### Requirement: Hex layout and ids

The board SHALL consist of exactly 19 land hexes in the 3-4-5-4-3 island layout, addressed by pointy-top axial coordinates (q, r) with `|q| ≤ 2`, `|r| ≤ 2` and `|q + r| ≤ 2`. Row 1 (the top row) SHALL be r = −2 and row 5 SHALL be r = 2. Within a row, q increases from left to right. Each hex SHALL have a stable integer id from 0 to 18, assigned in reading order (rows top to bottom, then left to right). The ids SHALL be identical on every run and on every platform.

#### Scenario: Row sizes
- **WHEN** the hexes are grouped by row
- **THEN** the rows have 3, 4, 5, 4 and 3 hexes from top to bottom

#### Scenario: Reading-order ids
- **WHEN** the hex ids are listed
- **THEN** hex 0 is the leftmost hex of row 1, hex 2 is the rightmost hex of row 1, hex 9 is the center hex (0, 0) and hex 18 is the rightmost hex of row 5

### Requirement: Intersections and paths

The board SHALL have exactly 54 intersections and 72 paths, each with a stable integer id (intersections 0–53, paths 0–71), assigned in reading order of their positions (top to bottom, then left to right). Each intersection SHALL list the 1–3 hexes it touches, the 2–3 paths that end at it and its neighboring intersections, which are the intersections one path away. Each path SHALL list exactly 2 intersections and the 1–2 hexes it borders. Each hex SHALL list its 6 corner intersections and 6 side paths in a fixed corner order. All of these relations SHALL be mutually consistent.

#### Scenario: Counts
- **WHEN** the topology is built
- **THEN** it contains 19 hexes, 54 intersections and 72 paths

#### Scenario: Interior intersection
- **WHEN** the intersections of the center hex are inspected
- **THEN** each of them touches exactly 3 hexes and has exactly 3 paths and 3 neighboring intersections

#### Scenario: Relations are symmetric
- **WHEN** path P lists intersections A and B
- **THEN** A and B each list P among their paths, and A lists B as a neighbor and B lists A

### Requirement: Coastal paths and intersections

A path that borders exactly one hex SHALL be coastal (it lies between a hex and the sea frame). An intersection that touches fewer than 3 hexes SHALL be coastal. The board SHALL have exactly 30 coastal paths and 30 coastal intersections. Coastal paths SHALL have a defined clockwise order, as viewed from above with row 1 at the top. Position 0 in that order is the upper-left side of hex 0.

#### Scenario: Coastal counts
- **WHEN** the coastal paths and intersections are counted
- **THEN** there are 30 of each

#### Scenario: Clockwise coastal order
- **WHEN** the coastal paths are listed in clockwise order
- **THEN** the first path is the upper-left side of hex 0, the second is the upper-right side of hex 0, and the order continues around the island in a single loop that visits each coastal path once

### Requirement: Harbor slots

The sea frame SHALL define exactly 9 harbor slots, numbered 0–8. Each slot SHALL be one coastal path. In clockwise coastal order, the slots SHALL sit at positions 0, 3, 6, 10, 13, 16, 20, 23 and 26. No intersection SHALL belong to more than one harbor slot. A player SHALL be considered to have a harbor when they own a settlement or city on either intersection of that harbor's slot path. The topology SHALL expose, for every intersection, the harbor slot it belongs to (if any).

#### Scenario: Nine disjoint slots
- **WHEN** the harbor slots are listed
- **THEN** there are 9, each on a coastal path, and their 18 end intersections are all distinct

#### Scenario: Harbor lookup by intersection
- **WHEN** the harbor slot of either end intersection of slot 4's path is looked up
- **THEN** the result is slot 4
- **AND** an intersection on no slot path has no harbor slot

### Requirement: World coordinates

The topology SHALL provide world-space positions on the board plane, with 1 unit equal to the hex circumradius and the board centered at the origin. It SHALL provide hex centers, intersection positions, and path midpoints with their direction angle. For every coastal path, it SHALL also provide the outward direction (pointing toward the sea). Positions SHALL be consistent with the topology, so a hex's corner intersections lie at its corners and a path's midpoint lies halfway between its two intersections. These helpers SHALL be importable by the client without importing rules logic.

#### Scenario: Corners coincide
- **WHEN** an intersection shared by three hexes is positioned
- **THEN** its position equals the matching corner of each of the three hexes

#### Scenario: Outward direction of a coastal path
- **WHEN** the outward direction of a coastal path is read
- **THEN** it points away from the path's only hex

### Requirement: Board value

A board SHALL be plain JSON data. For each hex it gives the terrain (forest, pasture, fields, hills, mountains or desert) and the number token value (2–12 excluding 7, or none for the desert). It also gives the harbor type on each of the 9 slots (generic 3:1, or 2:1 brick, grain, lumber, ore or wool) and the hex the robber is on. Every board SHALL contain exactly 4 forest, 4 pasture, 4 fields, 3 hills, 3 mountains and 1 desert. It SHALL contain exactly the 18 token values one each of 2 and 12 and two each of 3, 4, 5, 6, 8, 9, 10 and 11, and exactly 4 generic and 5 special harbors (one of each resource). The desert SHALL never carry a token, and the robber SHALL start on the desert.

#### Scenario: JSON round-trip
- **WHEN** a board is serialized to JSON and parsed back
- **THEN** the result is deep-equal to the original board

#### Scenario: Component counts hold for every setup
- **WHEN** a beginner board or any variable board is created
- **THEN** its terrain, token and harbor counts match the component counts above
- **AND** the robber is on the desert, which has no token

### Requirement: Beginner board

The beginner board SHALL use exactly this layout, by row from top to bottom and left to right (terrain and token):
- Row 1: Mountains 10, Pasture 2, Forest 9
- Row 2: Fields 12, Hills 6, Pasture 4, Hills 10
- Row 3: Fields 9, Forest 11, Desert (no token), Forest 3, Mountains 8
- Row 4: Forest 8, Mountains 3, Fields 4, Pasture 5
- Row 5: Hills 5, Fields 6, Pasture 11

The harbor slots 0 through 8 SHALL hold, in order: generic 3:1, 2:1 grain, 2:1 ore, generic 3:1, 2:1 wool, generic 3:1, generic 3:1, 2:1 brick, 2:1 lumber. The robber SHALL start on the desert (hex 9). Creating the beginner board SHALL use no randomness. Beginner pre-placed settlements and roads are not part of the board: no verified source for their positions is available, so games using the beginner board run the normal setup phase.

#### Scenario: Exact layout
- **WHEN** the beginner board is created
- **THEN** hex 0 is mountains with token 10, hex 9 is the desert with no token, and hex 18 is pasture with token 11
- **AND** every other hex matches the table above

#### Scenario: Harbor order
- **WHEN** the harbor types of the beginner board are listed by slot
- **THEN** they are generic, grain, ore, generic, wool, generic, generic, brick, lumber

#### Scenario: No randomness
- **WHEN** the beginner board is created twice
- **THEN** both boards are deep-equal and no RNG state is consumed

### Requirement: Variable board

Creating a variable board SHALL take an RNG state and return the board together with the next RNG state. It SHALL draw randomness in this fixed order:
1. Shuffle the 19 terrains onto the 19 hexes.
2. Shuffle the 9 harbor types onto the 9 slots.
3. Choose one of the 6 corner hexes of the island as the token start.

Number tokens SHALL then be placed in letter order A to R with these values: A=5, B=2, C=6, D=3, E=8, F=10, G=9, H=12, I=11, J=4, K=8, L=10, M=9, N=4, O=5, P=6, Q=3, R=11. Placement starts at the chosen corner hex and spirals counter-clockwise toward the center: first the 12 outer hexes, then the 6 middle-ring hexes starting with the one adjacent inward to the start corner, then the center hex. The desert SHALL be skipped without consuming a letter. The robber SHALL start on the desert. The same input RNG state SHALL always produce the same board and the same next RNG state.

#### Scenario: Deterministic from the seed
- **WHEN** two variable boards are created from RNG states made from the same seed
- **THEN** the boards are deep-equal and the returned RNG states are equal

#### Scenario: Different seeds vary the board
- **WHEN** variable boards are created from 20 different seeds
- **THEN** at least two of them have different terrain layouts

#### Scenario: Spiral token order
- **WHEN** a variable board's start corner is known and no desert lies in the first two spiral positions
- **THEN** the start corner hex has token 5 (A) and the next hex counter-clockwise along the coast has token 2 (B)

#### Scenario: Desert is skipped
- **WHEN** the desert lies at spiral position k
- **THEN** it has no token, and the hex at spiral position k+1 receives the letter that would otherwise have gone to position k
