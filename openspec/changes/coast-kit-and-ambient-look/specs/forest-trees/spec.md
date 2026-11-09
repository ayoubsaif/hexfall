## Purpose

Show forest hexes as real little woods on capable devices: a grass ground with 3D evergreens standing on it, without hiding anything the game needs.

## ADDED Requirements

### Requirement: 3D forests on Medium and High quality
When the graphics quality is Medium or High and a raised island theme is shown, every forest hex SHALL be drawn with a grass ground instead of its painted forest art, and SHALL carry between 5 and 9 evergreen trees of varied size and rotation. On Low quality, forest hexes SHALL keep their painted art and SHALL carry no 3D trees. Changing the quality SHALL switch between the two looks without a reload.

#### Scenario: High quality forest
- **WHEN** the graphics quality is High
- **THEN** each forest hex shows grass with 3D evergreens on it

#### Scenario: Low quality forest
- **WHEN** the graphics quality is Low
- **THEN** each forest hex shows its painted forest art and no 3D trees

#### Scenario: Forest still recognisable
- **WHEN** a forest hex is shown with 3D trees
- **THEN** it is distinguishable at the default camera from pasture, fields, hills, mountains and desert

### Requirement: Realistic forest floor
On Medium and High quality, the ground of a forest hex SHALL read as a natural forest floor rather than a flat colour: grass with light and shade patches, sun-dried spots and patches of needle litter, a grass texture whose tiling does not line up, and fine blade grain that fades out before it can shimmer when zoomed out. Each forest hex SHALL also carry 18 to 26 small 3D grass tufts between its trees, following the same clear zones as the trees.

#### Scenario: Forest floor on High
- **WHEN** a forest hex is drawn on High quality
- **THEN** its ground shows varied grass and needle patches, and 18 to 26 grass tufts stand between the trees

#### Scenario: Tufts stay clear of play
- **WHEN** the tufts of any forest hex are placed
- **THEN** none sits on the number chip, the robber's spot, a corner or an edge, or inside a tree trunk

### Requirement: Forest trees stay clear of play
Forest trees SHALL NOT overlap the hex's number chip, the robber's spot on that hex, any intersection of the hex (with a margin large enough that a settlement or city there is never overlapped) or any of its paths (with a margin for a road). Every tree SHALL be shorter than a city piece. Trees SHALL NOT take part in picking, so clicking or tapping a forest hex, its chip or its intersections behaves exactly as without trees.

#### Scenario: Robber moves to a forest
- **WHEN** the robber is moved onto a forest hex with 3D trees
- **THEN** the robber and the number chip are fully visible

#### Scenario: Click through trees
- **WHEN** the user clicks a legal intersection on a forest hex
- **THEN** that intersection is picked

### Requirement: Deterministic forests
The positions, sizes, rotations and variants of forest trees SHALL depend only on the hex and the theme, so every player sees the same forests and they do not change between renders or reloads.

#### Scenario: Same forest on reload
- **WHEN** the same board is shown twice at High quality
- **THEN** every forest tree has the same position, rotation, scale and variant both times
