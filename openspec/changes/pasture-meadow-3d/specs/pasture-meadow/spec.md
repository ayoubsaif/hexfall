## ADDED Requirements

### Requirement: 3D pastures on Medium and High quality
When the graphics quality is Medium or High and a raised island theme is shown, every pasture hex SHALL be drawn with a meadow ground instead of its painted pasture art, and SHALL carry a sheep camp: one shepherd's hut, at least two fence segments along the rim, a sandy path of short straight legs that hugs the number chip from the hut door to the flock without touching it, a flock of 3 to 5 sheep of varied pose, size and rotation, 10 to 16 grass tufts and at most two bushes. On Low quality, pasture hexes SHALL keep their painted art and SHALL carry no sheep. Changing the quality SHALL switch between the two looks without a reload.

#### Scenario: High quality pasture
- **WHEN** the graphics quality is High
- **THEN** each pasture hex shows a meadow with a hut, a fence, a straight sandy path and 3 to 5 sheep

#### Scenario: Low quality pasture
- **WHEN** the graphics quality is Low
- **THEN** each pasture hex shows its painted pasture art and no sheep

#### Scenario: Pasture still recognisable
- **WHEN** a pasture hex is shown with sheep
- **THEN** it is distinguishable at the default camera from forest, fields, hills, mountains and desert

### Requirement: Meadow ground
On Medium and High quality, the ground of a pasture hex SHALL read as a meadow: bright grass, brighter than the forest floor, with lusher clover patches and small white and yellow flowers that fade out before they can shimmer when zoomed out.

#### Scenario: Meadow on High
- **WHEN** a pasture hex is drawn on High quality
- **THEN** its ground shows bright grass with clover patches and small flowers

### Requirement: Sheep stay clear of play
Sheep, camp props (hut, fence, hay), tufts and bushes on a pasture SHALL NOT overlap the hex's number chip, the robber's spot, any intersection of the hex (with a margin for a settlement or city) or any of its paths (with a margin for a road). For a fence this holds for every post and rail along the segment. No two sheep SHALL overlap each other or a camp prop. Every sheep SHALL be shorter than half a city piece, and the hut SHALL be shorter than a settlement and SHALL use no player colour. They SHALL NOT take part in picking.

#### Scenario: Robber moves to a pasture
- **WHEN** the robber is moved onto a pasture hex with sheep
- **THEN** the robber and the number chip are fully visible

#### Scenario: Click through the meadow
- **WHEN** the user clicks a legal intersection on a pasture hex
- **THEN** that intersection is picked

### Requirement: Deterministic flocks
The positions, poses, sizes and rotations of sheep, camp props, tufts and bushes on pastures, and the course of the dirt path, SHALL depend only on the hex and the theme, so every player sees the same flocks and they do not change between renders or reloads.

#### Scenario: Same flock on reload
- **WHEN** the same board is shown twice at High quality
- **THEN** every sheep has the same position, rotation, scale and variant both times
