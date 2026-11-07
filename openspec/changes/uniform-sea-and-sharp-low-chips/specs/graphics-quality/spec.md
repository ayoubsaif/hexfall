## Purpose

Defines what the graphics quality setting (Auto, Low, Medium, High) changes on the board, so
the sea looks the same at every level and Low stays sharp on high-density screens.

## ADDED Requirements

### Requirement: Uniform sea across quality levels

The sea and coast SHALL look the same at Low, Medium and High, in both the Realistic and Classic
graphics modes, and SHALL use the High level's waves: the full water shading, 7 wave octaves, a
finely subdivided water surface, detailed rocks, and the GPU shallow-water simulation in which
waves reflect off the coast rocks and the shore and foam where they hit, with the raised beach.
Where float render targets are unsupported, every level SHALL fall back to the same analytic
waves. Classic keeps its flat surface and runs no simulation.
Changing the quality level, or Auto lowering it during play, SHALL NOT change how the sea looks.
Reduced motion SHALL still freeze the sea at every level.

#### Scenario: Same sea on High and Low
- **WHEN** the player switches graphics quality from Low to High in the Realistic mode
- **THEN** the sea, surf, shallows and coast rocks look the same as on High, and only shadows and sharpness change

#### Scenario: Auto downgrade leaves the sea alone
- **WHEN** Auto lowers the quality from High to Medium because the frame rate is low
- **THEN** the sea does not visibly change

#### Scenario: Waves collide with the rocks at Low
- **WHEN** the board shows in Realistic Low, on a device that supports float render targets, with motion not reduced
- **THEN** waves reflect off the coast rocks and foam where they hit them, as on High

#### Scenario: No float render targets
- **WHEN** the device cannot render to float targets
- **THEN** every quality level shows the same analytic waves and no simulation runs

### Requirement: Sharp board at Low quality

Low SHALL render the board at the device pixel ratio, capped at 1.5, and never below 1. Medium
SHALL cap at 1.5 and High at 2. On a screen with a device pixel ratio of 1.5 or more, number-chip
and harbor-chip labels at Low SHALL be as sharp as at Medium. Low SHALL still render without
shadows.

#### Scenario: Phone at Low
- **WHEN** the board shows at Low on a phone with a device pixel ratio of 3
- **THEN** the board renders at 1.5× density and the chip numbers are not blurred by upscaling

#### Scenario: Standard screen at Low
- **WHEN** the board shows at Low on a screen with a device pixel ratio of 1
- **THEN** the board renders at 1× density, as before

#### Scenario: Low keeps its savings
- **WHEN** the board shows at Low
- **THEN** pieces and hexes cast no shadows

### Requirement: Resource harbor chip colours

Each 2:1 resource harbor chip SHALL use paper tinted with a light shade of its resource's colour
(brick, grain, lumber, ore, wool), with a distinct tint per resource. The plain 3:1 chip and the
number chips SHALL keep the pale yellow paper. Every tint SHALL keep a contrast of at least 4.5:1
with the dark rate text. The tint SHALL NOT depend on the graphics quality.

#### Scenario: Ore harbor reads as ore
- **WHEN** the board shows an ore 2:1 harbor and a lumber 2:1 harbor
- **THEN** the ore chip has a light grey-blue paper and the lumber chip a light green one, and both rates are legible

#### Scenario: Generic harbor unchanged
- **WHEN** the board shows a 3:1 harbor
- **THEN** its chip has the same yellow paper as the number chips
