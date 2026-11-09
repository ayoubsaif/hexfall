# mountain-peaks Specification

## Purpose
How mountain hexes look on Medium and High graphics quality: one whole-hex 3D mountain from the owner's model, kept clear of the number chip, the robber and the pieces.

## Requirements

### Requirement: Deterministic mountains

Mountain placement SHALL depend only on the hex id, so the same board always shows the same mountains for every player.

#### Scenario: Same board, same mountains
- **WHEN** the mountain props of the same board are computed twice
- **THEN** both results are identical

### Requirement: Whole-hex mountain from the owner's model

On Medium and High graphics quality, each mountain hex SHALL carry exactly one mountain: the owner-supplied low-poly twin-peak mountain of grey faceted rock with white snow patches, spread over the whole hexagon. Mountain hexes SHALL carry no other props (no stone clusters, ore clusters, trees or pebbles). The mountain SHALL come in two forms, as supplied and mirrored, and each mountain hex SHALL pick one of them by its hex id. The model SHALL stay low poly (about 2k triangles or fewer) and its source file SHALL NOT be shipped with the game. On Low quality, mountain hexes SHALL keep the painted art.

#### Scenario: One mountain fills the hex
- **WHEN** a board with mountain hexes is shown on High quality
- **THEN** each mountain hex shows one twin-peak snowy mountain spanning the hexagon and no rocks, ore, trees or pebbles

#### Scenario: Neighbouring mountains vary
- **WHEN** the mountain props of the same board are computed twice
- **THEN** each mountain hex gets the as-supplied or mirrored form chosen by its hex id, the same both times

### Requirement: Whole-hex mountain keeps play visible

The mountain SHALL sink to ground level along the hex rim, so no part of it rises above the land at any hex corner (settlements, cities) or along any hex edge (roads). It SHALL leave a clearing at the centre where the number chip and the robber stand on the ground. From the default camera, it SHALL NOT hide the number chip, the robber, or a settlement or city on any corner of the hex, and clicks on the hex's corners and edges SHALL still select them.

#### Scenario: Rim is flat
- **WHEN** the mountain of any mountain hex is placed
- **THEN** its surface is at ground level at every corner and along every edge of the hex

#### Scenario: Chip and robber stay visible
- **WHEN** a mountain hex is seen from the default camera, with or without the robber on it
- **THEN** the number chip and the robber are fully visible in the clearing

#### Scenario: Corner pieces stay visible
- **WHEN** a settlement or city stands on any corner of a mountain hex
- **THEN** it is visible from the default camera and can still be clicked
