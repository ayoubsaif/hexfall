## ADDED Requirements

### Requirement: 3D mountains on mountain hexes

On Medium and High graphics quality, every mountain hex SHALL show a scree floor instead of the painted mountain art. It SHALL carry one big grey low-poly mountain in the middle of the hex, standing behind the number chip as seen from the default camera, plus 3 to 4 clusters of grey stones, one cluster of ore rocks with blue seams like the ore resource icon, a few small spruces and some grey pebbles. No other hex SHALL carry peaks or ore. On Low quality, mountain hexes SHALL keep the painted art.

#### Scenario: Mountains on High
- **WHEN** a board is shown on High quality
- **THEN** each mountain hex shows a scree floor with one mountain behind the chip, 3 to 4 grey stone clusters and one ore cluster

#### Scenario: Other terrains have no peaks
- **WHEN** a board is shown on High quality
- **THEN** no forest, pasture, fields, hills or desert hex shows a mountain or rock cluster

#### Scenario: Low quality keeps the painted art
- **WHEN** a board is shown on Low quality
- **THEN** mountain hexes show the painted mountain art and no peaks

### Requirement: Mountain props stay clear of play

Every mountain, rock cluster, spruce and boulder on a mountain hex SHALL keep its footprint clear of the number chip, the robber's spot, the hex corners (settlements and cities) and the hex edges (roads). The mountain SHALL NOT hide a piece on any hex corner from the default camera.

#### Scenario: Clear of the chip and robber
- **WHEN** the props of any mountain hex are placed
- **THEN** none of them overlaps the number chip or the robber's spot

#### Scenario: Clear of corners and edges
- **WHEN** the props of any mountain hex are placed
- **THEN** none of them overlaps a corner or an edge of the hex

#### Scenario: The mountain never hides corner pieces
- **WHEN** the mountain of any mountain hex is seen from the default camera
- **THEN** a settlement or city on any corner of that hex stays visible

### Requirement: Deterministic mountains

Mountain placement SHALL depend only on the hex id, so the same board always shows the same mountains for every player.

#### Scenario: Same board, same mountains
- **WHEN** the mountain props of the same board are computed twice
- **THEN** both results are identical
