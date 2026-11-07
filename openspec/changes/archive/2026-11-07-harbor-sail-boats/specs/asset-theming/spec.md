## MODIFIED Requirements

### Requirement: Asset requests by key

Scene components SHALL request every visual asset by a stable asset key and MUST NOT reference asset file paths (model or image) directly. The supported key set SHALL be exactly: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`, `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`, `dice.die`, `prop.boat`. Resolving a supported key SHALL always produce a renderable asset, whether themed or procedural.

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

#### Scenario: Boat key resolves
- **WHEN** a harbor marker requests the key `prop.boat`
- **THEN** the theme layer returns a renderable boat, themed or procedural, whose sail and mast can be found by the requesting component

### Requirement: Model coordinate contract

Every themed asset SHALL follow this contract: Y-up; 1 unit equals the hex circumradius (center-to-corner distance).
- **Hex images** (`tile.*`, `sea`) SHALL be square. They are mapped onto a flat pointy-top hex lying on y=0, with the image center at the hex center. The image spans 2 units in each direction, so the image's top and bottom edges touch the hex's top and bottom corners. Pixels outside the hex are not shown. The top of the image SHALL face the top of the board (row 1).
- **Token and harbor images** (`token`, `harbor.*`) SHALL be square. They are mapped onto the flat marker shape the board draws for them, centered on the marker.
- **Model keys** (`piece.*`) SHALL have the origin at the base center and rest on y=0.
- **The die** (`dice.die`) SHALL be white with black pips, SHALL have its origin at its center and an edge of 0.30 units, with its values on fixed local axes: +Y=1, +Z=2, +X=3, −X=4, −Z=5, −Y=6.
- **The boat** (`prop.boat`) SHALL have its origin at the center of the hull's waterline, resting on y=0 (the sea surface), with its length along the X axis. It SHALL contain one mesh whose node name contains `Sail` (case-insensitive), whose face points along ±X before any turn, and one node whose name contains `Mast`, whose X/Z position is the vertical axis the sail turns about. The mast and nodes whose names contain `Yard`, `Sheet` or `Lashing` SHALL turn and lean with the sail, about the mast's foot. When no mast node is present, the sail SHALL turn about the vertical axis through its own bounding-box center. A sail without texture coordinates SHALL be accepted; the client generates them.

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

#### Scenario: Boat floats on the sea
- **WHEN** a conforming `prop.boat` model is placed at a harbor
- **THEN** its hull's waterline sits at the sea surface, neither floating above nor sunk below it

#### Scenario: Sail found by name
- **WHEN** a `prop.boat` model has a node named `Boat Sail` and a node named `Boat Mast`
- **THEN** the client paints the harbor label on `Boat Sail` and turns it about the mast's vertical axis

### Requirement: Procedural fallback for every key

Every supported asset key SHALL have a built-in procedural representation that requires no asset files. For flat keys it is a flat shape in a key-specific color: a flat hex for `tile.*` and `sea`, a flat disc for `token`, and a flat badge for `harbor.*`. For model keys it is a simple 3D shape; for `prop.boat` it is a simple hull with a mast and a flat sail that follows the boat contract (named sail and mast parts), so it carries the same sail label and turn as the themed boat. The procedural fallback SHALL be rendered when the active theme does not map the key, while the mapped file is loading, or when the mapped file fails to load or decode. The fallbacks for different terrain and harbor keys SHALL be visually distinguishable from one another. Flat fallbacks SHALL have no raised 3D props. The game SHALL remain fully playable with zero asset files present.

#### Scenario: Zero model files
- **WHEN** the client runs with a theme that maps no keys, or with all asset files absent
- **THEN** every board element and piece renders using procedural fallbacks
- **AND** all game interactions remain available

#### Scenario: Fallback while loading
- **WHEN** a mapped image or model has not finished loading
- **THEN** the procedural fallback for that key is shown
- **AND** it is replaced by the themed asset once loading succeeds

#### Scenario: Terrains are distinguishable in fallback
- **WHEN** all six `tile.*` keys render as procedural fallbacks
- **THEN** each terrain type has a distinct flat color

#### Scenario: Fallback boat has a labelled sail
- **WHEN** `prop.boat` renders as its procedural fallback at an ore harbor
- **THEN** the fallback boat's sail shows the ore icon and "2:1"

### Requirement: Asset kinds

Every supported asset key SHALL have exactly one kind:
- **Flat** keys: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`. These are drawn as flat shapes on the board plane, optionally textured with an image.
- **Model** keys: `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`, `dice.die`, `prop.boat`. These are 3D objects, optionally loaded from a GLB model.

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
