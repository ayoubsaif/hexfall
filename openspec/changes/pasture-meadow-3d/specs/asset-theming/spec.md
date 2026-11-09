## MODIFIED Requirements

### Requirement: Asset kinds

Every supported asset key SHALL have exactly one kind:
- **Flat** keys: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`. These are drawn as flat shapes on the board plane, optionally textured with an image.
- **Model** keys: `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`, `dice.die`, `prop.boat`, `prop.jetty`, `prop.boulder`, `prop.cliff`, `prop.wall`, `prop.tree`, `prop.bush`, `prop.sheep`, `prop.camp`. These are 3D objects, optionally loaded from a GLB model.

The kind of a key SHALL be fixed and SHALL NOT depend on the theme.

#### Scenario: Tile keys are flat
- **WHEN** the kind of `tile.hills` is looked up
- **THEN** it is flat

#### Scenario: Piece keys are models
- **WHEN** the kind of `piece.city` is looked up
- **THEN** it is model

#### Scenario: The die is a model
- **WHEN** the kind of `dice.die` is looked up
- **THEN** it is model

#### Scenario: The boat is a model
- **WHEN** the kind of `prop.boat` is looked up
- **THEN** it is model

#### Scenario: Coast kit keys are models
- **WHEN** the kind of `prop.boulder`, `prop.cliff`, `prop.wall`, `prop.tree` or `prop.bush` is looked up
- **THEN** it is model

#### Scenario: The pasture props are models
- **WHEN** the kind of `prop.sheep` or `prop.camp` is looked up
- **THEN** it is model
