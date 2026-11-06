## MODIFIED Requirements

### Requirement: Asset requests by key

Scene components SHALL request every visual asset by a stable asset key and MUST NOT reference asset file paths (model or image) directly. The supported key set SHALL be exactly: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`, `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`, `dice.die`. Resolving a supported key SHALL always produce a renderable asset, whether themed or procedural.

#### Scenario: Supported key resolves to a renderable asset
- **WHEN** a scene component requests the key `tile.forest`
- **THEN** the theme layer returns a renderable asset for that key
- **AND** the requesting component does not need to know whether it is a themed texture or a procedural fallback

#### Scenario: Scene code contains no model file paths
- **WHEN** the client source outside the theme layer and theme manifests is inspected
- **THEN** it contains no references to model (GLB) or texture image file paths

#### Scenario: Die key resolves
- **WHEN** the board dice request the key `dice.die`
- **THEN** the theme layer returns a renderable die, themed or procedural

### Requirement: Model coordinate contract

Every themed asset SHALL follow this contract: Y-up; 1 unit equals the hex circumradius (center-to-corner distance).
- **Hex images** (`tile.*`, `sea`) SHALL be square. They are mapped onto a flat pointy-top hex lying on y=0, with the image center at the hex center. The image spans 2 units in each direction, so the image's top and bottom edges touch the hex's top and bottom corners. Pixels outside the hex are not shown. The top of the image SHALL face the top of the board (row 1).
- **Token and harbor images** (`token`, `harbor.*`) SHALL be square. They are mapped onto the flat marker shape the board draws for them, centered on the marker.
- **Model keys** (`piece.*`) SHALL have the origin at the base center and rest on y=0.
- **The die** (`dice.die`) SHALL be white with black pips, SHALL have its origin at its center and an edge of 0.30 units, with its values on fixed local axes: +Y=1, +Z=2, +X=3, −X=4, −Z=5, −Y=6.

The theme layer SHALL place assets assuming this contract. Procedural fallbacks SHALL follow the same contract, so swapping a themed asset for its fallback (or vice versa) does not move or resize the asset's placement.

#### Scenario: Conforming hex model aligns with the board
- **WHEN** a hex image that follows the contract is placed at a hex position
- **THEN** the textured hex's corners coincide with the corners of the neighboring hexes
- **AND** it lies on the board surface

#### Scenario: Conforming piece rests on the surface
- **WHEN** a `piece.settlement` model that follows the contract is placed on an intersection
- **THEN** its base sits on the board surface with no gap and no sinking

#### Scenario: Fallback and themed model share placement
- **WHEN** a key switches from its procedural fallback to its loaded themed asset
- **THEN** the asset stays at the same position and footprint on the board

#### Scenario: Fallback die shows the same value
- **WHEN** a resting die switches from its procedural fallback to the loaded `dice.die` model
- **THEN** the same value faces up and the die does not move or resize

### Requirement: Asset kinds

Every supported asset key SHALL have exactly one kind:
- **Flat** keys: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`. These are drawn as flat shapes on the board plane, optionally textured with an image.
- **Model** keys: `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`, `dice.die`. These are 3D objects, optionally loaded from a GLB model.

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

## ADDED Requirements

### Requirement: Reproducible die model conversion

The project SHALL provide a command-line conversion that turns the committed die source (`Dice.obj` with its `Dice.mtl`) into a GLB for `dice.die` in the default theme folder. The conversion SHALL be deterministic: the same sources SHALL produce the same output bytes. The output SHALL follow the die's coordinate contract: origin at the center, an edge of 0.30 units (within 1 %), values on the contract's axes. It SHALL turn the two source materials into a body material (`Body`, from the source's `Red`) colored white and a pip material (`Pips`, from the source's `White`) colored black, the same colors as the procedural die. It SHALL use indexed geometry with normals, be meshopt-compressed and fit the 300 KB per-model budget without a warning. The conversion SHALL check the source's face map by counting pip geometry on each side, and SHALL fail if the source does not show 1 to 6 pips on the contract's axes. The source files SHALL live in a committed folder outside `assets/`, next to a record of their author, URL and license. The theme SHALL NOT map `dice.die` until that record names an allowed license.

#### Scenario: Converted die follows the contract
- **WHEN** the conversion runs on the committed die source
- **THEN** the GLB's bounding box is centered on the origin (within 1e-3) with an edge of 0.30 (within 1 %), and it has the materials `Body` (white) and `Pips` (black)

#### Scenario: Face map checked
- **WHEN** the conversion runs on a source whose +Y side carries two pips instead of one
- **THEN** it fails and names the side and the pip count found

#### Scenario: Die conversion is deterministic
- **WHEN** the conversion runs twice on unchanged sources
- **THEN** both runs produce byte-identical GLB files

#### Scenario: Unlicensed die not mapped
- **WHEN** the die source record has no license yet
- **THEN** the default theme does not map `dice.die` and the procedural die is used
