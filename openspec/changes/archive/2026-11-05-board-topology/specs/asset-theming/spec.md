## ADDED Requirements

### Requirement: Asset kinds

Every supported asset key SHALL have exactly one kind:
- **Flat** keys: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`. These are drawn as flat shapes on the board plane, optionally textured with an image.
- **Model** keys: `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`. These are 3D objects, optionally loaded from a GLB model.

The kind of a key SHALL be fixed and SHALL NOT depend on the theme.

#### Scenario: Tile keys are flat
- **WHEN** the kind of `tile.hills` is looked up
- **THEN** it is flat

#### Scenario: Piece keys are models
- **WHEN** the kind of `piece.city` is looked up
- **THEN** it is model

### Requirement: Original painted tile art

The default theme SHALL map each of the six `tile.*` keys to an original painted top-down texture image. The `sea` key SHALL also map to an original texture, which MAY be rasterized from hand-written vector art (owner decision, 2026-11-04: the generation budget covered only the six terrains). Each image SHALL be created without using any file from the repository's `assets/` folder, or any other existing artwork, as an input or reference. The default theme's manifest SHALL declare how the images were made and under what license. An image SHALL be added to the default theme only after the user has approved it.

#### Scenario: Default theme ships tile textures
- **WHEN** the client runs with the default theme
- **THEN** the six terrain tiles render painted textures rather than flat colors

#### Scenario: Provenance is declared
- **WHEN** the default theme manifest is inspected
- **THEN** its license/source declaration states that the tile images are original and how they were produced

### Requirement: Isometric tile images

A flat entry for a hex key (`tile.*` or `sea`) MAY declare `"projection": "isometric"`; the default is `"top"`. An isometric image SHALL be 16:17 (reference 1024 × 1088 px). Its top 1024 × 1024 px hold the hex's top face as seen from 60° above the board, with corners at (512,0), (1024,256), (1024,768), (512,1024), (0,768), (0,256). The 64 px band below holds the earth of the two side faces facing the player. A `projection` on a token or harbor key, or any other value, SHALL invalidate the manifest. The repository SHALL ship SVG templates for both formats under `docs/art/`, and the asset check SHALL fail on an isometric image that is not 16:17.

#### Scenario: Isometric entry accepted
- **WHEN** a manifest maps `tile.forest` to `{ "image": "tiles/forest.webp", "projection": "isometric" }`
- **THEN** the manifest is valid and the key resolves to an isometric image

#### Scenario: Projection on a non-hex key rejected
- **WHEN** a manifest maps `harbor.ore` to an image with a `projection`
- **THEN** the manifest is invalid and the error names the key

#### Scenario: Wrong isometric size fails the check
- **WHEN** an isometric tile image is 1024 × 1024
- **THEN** `node tools/check-assets.mjs` exits with an error naming the key and the expected 16:17 size

## MODIFIED Requirements

### Requirement: Asset requests by key

Scene components SHALL request every visual asset by a stable asset key and MUST NOT reference asset file paths (model or image) directly. The supported key set SHALL be exactly: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`, `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`. Resolving a supported key SHALL always produce a renderable asset, whether themed or procedural.

#### Scenario: Supported key resolves to a renderable asset
- **WHEN** a scene component requests the key `tile.forest`
- **THEN** the theme layer returns a renderable asset for that key
- **AND** the requesting component does not need to know whether it is a themed texture or a procedural fallback

#### Scenario: Scene code contains no model file paths
- **WHEN** the client source outside the theme layer and theme manifests is inspected
- **THEN** it contains no references to model (GLB) or texture image file paths

### Requirement: Theme manifest

A theme SHALL be described by a manifest that declares a theme identifier, a license/source declaration for its assets, and a mapping from asset keys to asset files. An entry for a flat key SHALL name one image file (PNG, WebP or JPEG). An entry for a model key SHALL name one GLB file and SHALL accept optional transform overrides (see "Per-asset transform overrides"). A manifest SHALL NOT be required to map every key; unmapped keys use the procedural fallback. The client SHALL ship a default theme.

#### Scenario: Mapped key uses the theme model
- **WHEN** the active theme maps `piece.city` to a GLB file that loads successfully
- **THEN** requests for `piece.city` render that model

#### Scenario: Mapped flat key uses the theme image
- **WHEN** the active theme maps `tile.forest` to an image file that loads successfully
- **THEN** forest tiles render as flat hexes textured with that image

#### Scenario: Partial manifest is valid
- **WHEN** the active theme maps only `tile.forest` and `tile.hills`
- **THEN** those two keys render their theme images
- **AND** every other key renders its procedural fallback without error

#### Scenario: Default theme is shipped
- **WHEN** the client is built with no theme configuration
- **THEN** the default theme is active

### Requirement: Model coordinate contract

Every themed asset SHALL follow this contract: Y-up; 1 unit equals the hex circumradius (center-to-corner distance).
- **Hex images** (`tile.*`, `sea`) SHALL be square. They are mapped onto a flat pointy-top hex lying on y=0, with the image center at the hex center. The image spans 2 units in each direction, so the image's top and bottom edges touch the hex's top and bottom corners. Pixels outside the hex are not shown. The top of the image SHALL face the top of the board (row 1).
- **Token and harbor images** (`token`, `harbor.*`) SHALL be square. They are mapped onto the flat marker shape the board draws for them, centered on the marker.
- **Model keys** (`piece.*`) SHALL have the origin at the base center and rest on y=0.

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

### Requirement: Per-asset transform overrides

A manifest entry for a model key SHALL accept optional overrides for scale, rotation and offset. When present, the overrides SHALL be applied to that model on top of the model contract, and SHALL affect only that key in that theme. When absent, the model SHALL be used as authored. Entries for flat keys SHALL NOT accept transform overrides, because flat assets must keep the board's exact footprint.

#### Scenario: Scale override is applied
- **WHEN** the manifest entry for `piece.robber` declares a uniform scale override of 0.5
- **THEN** the robber renders at half its authored size
- **AND** no other key's size changes

#### Scenario: No override means authored transform
- **WHEN** a manifest entry declares no overrides
- **THEN** the model renders with its authored scale, rotation and origin

#### Scenario: Override on a flat key is rejected
- **WHEN** the manifest entry for `tile.forest` declares a scale override
- **THEN** the manifest fails validation as described in "Manifest validation"

### Requirement: Procedural fallback for every key

Every supported asset key SHALL have a built-in procedural representation that requires no asset files. For flat keys it is a flat shape in a key-specific color: a flat hex for `tile.*` and `sea`, a flat disc for `token`, and a flat badge for `harbor.*`. For model keys it is a simple 3D shape. The procedural fallback SHALL be rendered when the active theme does not map the key, while the mapped file is loading, or when the mapped file fails to load or decode. The fallbacks for different terrain and harbor keys SHALL be visually distinguishable from one another. Flat fallbacks SHALL have no raised 3D props. The game SHALL remain fully playable with zero asset files present.

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

### Requirement: Load failure handling

An image or model that fails to load, decode or parse MUST NOT crash or blank the scene. The theme layer SHALL render that key's procedural fallback instead and SHALL emit a warning that names both the asset key and the theme identifier. A failure for one key SHALL NOT affect other keys.

#### Scenario: Missing image file
- **WHEN** the active theme `diorama` maps `tile.hills` to an image that returns a not-found error
- **THEN** `tile.hills` renders its procedural fallback
- **AND** a warning naming `tile.hills` and `diorama` is emitted
- **AND** the rest of the scene continues to render

#### Scenario: Missing model file
- **WHEN** the active theme `diorama` maps `piece.city` to a GLB file that returns a not-found error
- **THEN** `piece.city` renders its procedural fallback
- **AND** a warning naming `piece.city` and `diorama` is emitted

#### Scenario: Corrupt model file
- **WHEN** a mapped model file is not a valid GLB
- **THEN** that key renders its procedural fallback and a warning naming the key and theme is emitted

### Requirement: Manifest validation

The theme layer SHALL validate the active manifest before using it. Entries whose key is not in the supported key set SHALL be ignored, with a warning naming the unknown key; the remaining entries SHALL still be used. A manifest that fails validation as a whole SHALL NOT be used. Validation fails as a whole for:
- a malformed structure;
- a missing theme identifier;
- a missing license/source declaration;
- an entry with an invalid file reference;
- an entry whose file type does not match its key's kind (an image for a model key, or a GLB for a flat key);
- invalid override values, or overrides on a flat key.

When this happens, every key SHALL render its procedural fallback, and an error-level message naming the theme and the validation failure SHALL be emitted.

#### Scenario: Unknown key is ignored
- **WHEN** the manifest contains an entry for `piece.knight`
- **THEN** that entry is ignored and a warning naming `piece.knight` is emitted
- **AND** all valid entries in the manifest are still used

#### Scenario: Invalid manifest falls back entirely
- **WHEN** the active manifest is structurally malformed or lacks a license/source declaration
- **THEN** every key renders its procedural fallback
- **AND** an error-level message naming the theme and the reason is emitted
- **AND** the scene does not crash

#### Scenario: Kind mismatch invalidates the manifest
- **WHEN** the manifest maps `tile.forest` to a GLB file
- **THEN** the manifest fails validation and every key renders its procedural fallback

### Requirement: Asset budget check

The project SHALL provide a theme validation check, runnable from the command line and in CI, that inspects every asset file referenced by shipped theme manifests. The check SHALL warn, naming the theme, key and file size:
- for any model file that is not a compressed GLB or whose size exceeds 300 KB;
- for any image file whose size exceeds 400 KB.

Exceeding the budget SHALL NOT fail the check and SHALL NOT prevent the asset from loading at runtime. The check SHALL fail if a manifest references a file that does not exist. It SHALL also fail if a theme folder contains a model or image file that its manifest does not reference.

#### Scenario: Oversized model produces a warning
- **WHEN** the validation check runs and `piece.city` in the default theme references a 450 KB GLB
- **THEN** a warning naming the theme, `piece.city` and the file size is reported
- **AND** the check still passes
- **AND** the model still loads at runtime

#### Scenario: Oversized image produces a warning
- **WHEN** the validation check runs and `tile.mountains` references a 600 KB image
- **THEN** a warning naming the theme, `tile.mountains` and the file size is reported
- **AND** the check still passes

#### Scenario: Missing referenced file fails the check
- **WHEN** a shipped manifest references an asset file that does not exist in the repository
- **THEN** the validation check fails and names the theme, key and file

#### Scenario: Unreferenced image fails the check
- **WHEN** a theme folder contains `tiles/old-forest.webp` that its manifest does not reference
- **THEN** the validation check fails and names the theme and file
