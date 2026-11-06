# asset-theming Specification

## Purpose

Define how the 3D client resolves visual assets by stable key through a swappable theme manifest. This covers the model coordinate contract, runtime player-color tinting, procedural fallbacks and licensing guards, so art can be upgraded without changing scene or game logic.

## Requirements

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

### Requirement: Theme selection without code changes

Exactly one theme SHALL be active at a time. The active theme SHALL be selected through configuration by theme identifier. Adding a new theme SHALL require only adding a manifest and its model files and selecting it; it MUST NOT require changes to scene or game code. If the configured theme identifier does not match any available theme, the client SHALL activate the default theme and emit a warning naming the requested identifier.

#### Scenario: New theme is activated by configuration
- **WHEN** a developer adds a new theme manifest with its model files and sets the configured theme to its identifier
- **THEN** the client renders that theme's models
- **AND** no scene or game source file was modified

#### Scenario: Unknown theme identifier
- **WHEN** the configured theme identifier is `does-not-exist`
- **THEN** the default theme is active
- **AND** a warning naming `does-not-exist` is emitted

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

### Requirement: Player color tinting

Piece models (`piece.road`, `piece.settlement`, `piece.city`) SHALL be shared across all players and tinted at runtime with the owning player's color. If a piece model contains a material named `PlayerColor`, only surfaces using that material SHALL take the player's color, and all other materials SHALL keep their authored appearance. If a piece model contains no material named `PlayerColor`, the entire piece SHALL be rendered in the owning player's color. Procedural piece fallbacks SHALL be rendered in the owning player's color. Pieces of different players SHALL always be distinguishable by color. `piece.robber` SHALL NOT be tinted.

#### Scenario: Model with PlayerColor material
- **WHEN** a settlement model with a `PlayerColor` material is placed for a player whose color is blue
- **THEN** the `PlayerColor` surfaces render blue
- **AND** the model's other materials keep their authored colors

#### Scenario: Model without PlayerColor material
- **WHEN** a road model with no `PlayerColor` material is placed for a player whose color is red
- **THEN** the entire road renders red

#### Scenario: One model serves all players
- **WHEN** four players each own a city using the same city model
- **THEN** each city renders in its owner's color and the four are distinguishable

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

### Requirement: Licensing guard

Every shipped theme SHALL contain only original or permissively licensed assets. Allowed licenses SHALL be exactly `CC0-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-3.0`, `CC-BY-SA-4.0` and `MIT`. Non-commercial (`-NC`) and no-derivatives (`-ND`) licenses SHALL be rejected. The manifest SHALL declare the license and source of its assets. Assets under an attribution-required license (every allowed license except `CC0-1.0`) SHALL also be covered by a credit (see "Asset credits"). Files from the repository's `assets/` reference folder MUST NOT be included in the client build output, and theme manifests MUST NOT reference them. The theme validation check SHALL fail if any manifest references a file under `assets/`, lacks a license/source declaration, declares a license outside the allowed set, or maps an attribution-licensed asset without a credit.

#### Scenario: Reference folder excluded from build
- **WHEN** the client is built for production
- **THEN** the build output contains no file originating from the repository's `assets/` folder

#### Scenario: Manifest referencing reference art is rejected
- **WHEN** a theme manifest maps a key to a file under `assets/`
- **THEN** the theme validation check fails and names the offending theme, key and file

#### Scenario: License declaration is required
- **WHEN** a shipped theme manifest has no license/source declaration
- **THEN** the theme validation check fails and names the theme

#### Scenario: Disallowed license is rejected
- **WHEN** a credit declares the license `CC-BY-NC-4.0`
- **THEN** the theme validation check fails and names the theme, the credit's keys and the license

#### Scenario: Attribution license without a credit is rejected
- **WHEN** a manifest-level license is `CC-BY-4.0` and a mapped model key is not covered by any credit
- **THEN** the theme validation check fails and names the theme and the uncovered key

### Requirement: Asset credits

A theme manifest SHALL accept an optional `credits` list. Each credit SHALL name the asset keys it covers (each one a supported key mapped by that manifest), a title, an author, a source URL and a license identifier (SPDX form, for example `CC-BY-4.0`). Every mapped key whose asset is under a license that requires attribution SHALL be covered by exactly one credit. Keys not covered by any credit fall under the manifest-level license/source declaration.

#### Scenario: Credited third-party piece
- **WHEN** the `diorama` manifest maps `piece.city` to a model licensed `CC-BY-4.0` and includes a credit for `piece.city` with title, author, URL and `CC-BY-4.0`
- **THEN** the manifest is valid and `piece.city` renders that model

#### Scenario: Credit naming an unmapped key
- **WHEN** a credit lists `piece.robber` but the manifest does not map `piece.robber`
- **THEN** the theme validation check fails and names the theme and `piece.robber`

#### Scenario: Credit with a missing field
- **WHEN** a credit has no author or no URL
- **THEN** the theme validation check fails and names the theme, the credit's keys and the missing field

### Requirement: Credits are visible in the client

The client SHALL let any player open a credits view from the game HUD and from the start screen. The view SHALL list every credit of the active theme with its title, author, license and a link to its source URL. When the active theme has no credits, the view SHALL show the manifest-level license/source declaration.

#### Scenario: Credits listed for the active theme
- **WHEN** the active theme credits `piece.road`, `piece.settlement` and `piece.city` to one author under `CC-BY-4.0`
- **AND** a player opens the credits view
- **THEN** the view shows the title, author name, `CC-BY-4.0` and a working link to the source URL

#### Scenario: Theme without credits
- **WHEN** the active theme has no `credits` list and a player opens the credits view
- **THEN** the view shows that theme's license and source declaration

### Requirement: Reproducible piece model conversion

The project SHALL provide a command-line conversion that turns committed source meshes (STL) for `piece.road`, `piece.settlement` and `piece.city` into GLB files in the theme folder. The conversion SHALL be deterministic: the same sources and settings SHALL produce the same output bytes. The output SHALL follow the model coordinate contract: Y-up, origin at the base center, the lowest point at y=0. The road SHALL lie along local X with a length of 0.72 hex-circumradius units, the same as its procedural fallback. The settlement's longest horizontal side SHALL be 0.30 units and the city's 0.50 units (within 1 %), so the themed buildings are larger than their fallbacks and read clearly on the board. The output SHALL use indexed geometry with normals and SHALL be meshopt-compressed. It SHALL fit the 300 KB per-model budget without a warning. Source meshes SHALL live in a committed folder outside `assets/`, next to a record of their author, URL and license.

#### Scenario: Converted road follows the contract
- **WHEN** the conversion runs on the committed road source
- **THEN** the resulting GLB's bounding box has its minimum Y at 0 (within 1e-4), is centered on X and Z (within 1e-3), and its X extent is 0.72 (within 1 %)

#### Scenario: Conversion is deterministic
- **WHEN** the conversion runs twice on unchanged sources
- **THEN** both runs produce byte-identical GLB files

#### Scenario: Output passes the budget check
- **WHEN** the theme validation check runs after conversion
- **THEN** it reports no budget or compression warning for `piece.road`, `piece.settlement` or `piece.city`

#### Scenario: Converted model swaps in without moving
- **WHEN** a player's settlement switches from the procedural fallback to the converted model once loading finishes
- **THEN** the settlement stays on the same intersection and rests on the board surface
- **AND** its longest horizontal side is 0.30 units

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
