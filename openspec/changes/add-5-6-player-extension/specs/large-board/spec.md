## Purpose

Define the 30-hex island used by 5–6 player games: its topology, harbor slots, component counts and seeded variable setup, as static deterministic data alongside the standard 19-hex board.

## ADDED Requirements

### Requirement: Large hex layout and ids

The large board SHALL consist of exactly 30 land hexes in seven rows of 3, 4, 5, 6, 5, 4 and 3 hexes, addressed by pointy-top axial coordinates (q, r) with r from −3 (top row) to 3 (bottom row). The q range of each row SHALL be: r = −3: 1..3; r = −2: 0..3; r = −1: −1..3; r = 0: −2..3; r = 1: −2..2; r = 2: −2..1; r = 3: −2..0. Each hex SHALL have a stable integer id from 0 to 29 in reading order (rows top to bottom, then left to right). The ids SHALL be identical on every run and platform.

#### Scenario: Row sizes
- **WHEN** the large board's hexes are grouped by row
- **THEN** the rows have 3, 4, 5, 6, 5, 4 and 3 hexes from top to bottom

#### Scenario: Reading-order ids
- **WHEN** the large board's hex ids are listed
- **THEN** hex 0 is (1, −3), hex 12 is the leftmost hex of the middle row (−2, 0), and hex 29 is (0, 3)

### Requirement: Large board intersections, paths and coast

The large board SHALL have exactly 80 intersections and 109 paths with stable ids in reading order, and the same per-element relations as the standard board (hexes, paths and neighbors of each intersection; ends and hexes of each path; corners and sides of each hex), all mutually consistent. It SHALL have exactly 38 coastal paths and 38 coastal intersections, with a clockwise coastal order starting at the upper-left side of hex 0. It SHALL provide world coordinates centered at the origin with the same unit as the standard board, and a ring of 22 sea cells around the island.

#### Scenario: Counts
- **WHEN** the large topology is built
- **THEN** it contains 30 hexes, 80 intersections, 109 paths, 38 coastal paths, 38 coastal intersections and 22 sea cells

#### Scenario: Relations are symmetric
- **WHEN** path P of the large board lists intersections A and B
- **THEN** A and B each list P among their paths and list each other as neighbors

#### Scenario: Centered
- **WHEN** the world positions of all large-board hex centers are averaged
- **THEN** the average is the origin

### Requirement: Large board harbor slots

The large board's sea frame SHALL define exactly 11 harbor slots, numbered 0–10, each on one coastal path. In clockwise coastal order the slots SHALL sit at positions 0, 3, 7, 10, 14, 17, 21, 24, 28, 31 and 35. No intersection SHALL belong to more than one slot, and the topology SHALL expose the slot of every intersection (if any). Owning a building on either end of a slot path SHALL give its harbor, as on the standard board.

#### Scenario: Eleven disjoint slots
- **WHEN** the large board's harbor slots are listed
- **THEN** there are 11, each on a coastal path, and their 22 end intersections are all distinct

### Requirement: Large board components

A large board value SHALL contain exactly 6 forest, 6 pasture, 6 fields, 5 hills, 5 mountains and 2 deserts. It SHALL contain exactly 28 number tokens: two each of 2 and 12 and three each of 3, 4, 5, 6, 8, 9, 10 and 11. Neither desert SHALL carry a token. Its 11 harbors SHALL be 5 generic 3:1, 2 wool 2:1 and one 2:1 each for brick, grain, lumber and ore. The robber SHALL start on one of the deserts. The value SHALL be plain JSON.

#### Scenario: Component counts
- **WHEN** any large board is created
- **THEN** its terrain, token and harbor counts match the counts above, both deserts have no token, and the robber is on a desert

#### Scenario: JSON round-trip
- **WHEN** a large board is serialized to JSON and parsed back
- **THEN** the result is deep-equal to the original

### Requirement: Large variable board

Creating a large board SHALL take an RNG state and return the board with the next RNG state, drawing randomness in this fixed order: shuffle the 30 terrains onto the 30 hexes; shuffle the 11 harbor types onto the 11 slots; shuffle the 28 tokens onto the 28 non-desert hexes, reshuffling the tokens until no two hexes with a 6 or an 8 are adjacent. The robber SHALL start on the desert with the lower hex id. The same input RNG state SHALL always produce the same board and the same next RNG state. There SHALL be no beginner (fixed) large board.

#### Scenario: Deterministic from the seed
- **WHEN** two large boards are created from RNG states made from the same seed
- **THEN** the boards are deep-equal and the returned RNG states are equal

#### Scenario: Red numbers never touch
- **WHEN** large boards are created from 200 different seeds
- **THEN** on every one of them no hex with a 6 or 8 is adjacent to another hex with a 6 or 8

#### Scenario: Robber on the first desert
- **WHEN** a large board is created
- **THEN** the robber is on the desert with the lower hex id
