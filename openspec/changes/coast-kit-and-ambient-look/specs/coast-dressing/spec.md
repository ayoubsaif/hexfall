## Purpose

Make the island's edge look like a natural, rocky, vegetated shore (boulders, cliff rocks, low walls, trees and bushes) without ever getting in the way of the board or the game.

## ADDED Requirements

### Requirement: Rocky shore
When a raised island theme is shown, the shoreline SHALL carry a sparse scattering of boulders and cliff rocks of several sizes and shapes (roughly one rock spot in four along the shore, so the coast reads as beach with occasional rocks, not a ring of rocks), some reaching into the shallow water. Rocks SHALL sit on the beach or seabed surface (no floating rocks and no rocks buried more than half their height).

#### Scenario: Shore lined with rocks
- **WHEN** the board is shown with the diorama theme
- **THEN** a few rocks of at least three different shapes sit along the shore, never at harbors, with open beach between them

#### Scenario: Rocks rest on the ground
- **WHEN** any coast rock is placed
- **THEN** its base is within a small tolerance of the beach or seabed height at its position

### Requirement: Rim vegetation and walls
The outer rim of the island (between the outer hex edges and the waterline) SHALL carry grass tufts, bushes and pine trees, plus short low stone wall segments that follow the coast on some stretches away from harbors. Vegetation SHALL NOT be taller than a city piece, so it never hides pieces from the default camera.

#### Scenario: Trees on the rim
- **WHEN** the board is shown with the diorama theme
- **THEN** trees and bushes stand on the rim around the island

#### Scenario: Trees do not hide pieces
- **WHEN** a city is built on a coastal intersection and the camera is at the default view
- **THEN** no tree or bush is taller than that city

### Requirement: Clear zones
Coast props SHALL NOT be placed on any land hex, on any intersection or path of the board (with a margin large enough that a settlement, city or road there is never overlapped), on a harbor jetty, or in the water lane between a jetty and its boat. Number chips, pieces, pick targets and the robber SHALL remain fully clickable and visible.

#### Scenario: Coastal settlement spot stays clear
- **WHEN** a settlement is placed on a coastal intersection
- **THEN** no coast prop overlaps the settlement

#### Scenario: Harbor stays clear
- **WHEN** the board is shown
- **THEN** no coast prop overlaps a jetty or lies between a jetty and its boat

### Requirement: Deterministic placement
The placement of coast props SHALL depend only on the board layout and the theme, not on time, frame rate, quality tier or random state, so every player sees the same coast and it does not change between renders or reloads.

#### Scenario: Same coast on reload
- **WHEN** the same board is shown twice
- **THEN** every coast prop has the same position, rotation, scale and variant both times

### Requirement: Shore surfaces
The beach SHALL show a sand texture near the water that changes into a grass band toward the land, and rocks SHALL use a mossy rock texture with moss on their upward-facing surfaces. Textures SHALL be permissively licensed with their source recorded. When a texture is missing or fails to load, the shore SHALL still render with plain colors.

#### Scenario: Grass meets sand
- **WHEN** the beach is shown
- **THEN** it is sand at the waterline and grass at its land side, with a gradual transition

#### Scenario: Missing texture
- **WHEN** the grass texture file is absent
- **THEN** the beach still renders, using a plain grass color for that band
