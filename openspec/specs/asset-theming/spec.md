# asset-theming Specification

## Purpose

Define how the 3D client resolves visual assets by stable key through a swappable theme manifest. This covers the model coordinate contract, runtime player-color tinting, procedural fallbacks and licensing guards, so art can be upgraded without changing scene or game logic.

## Requirements

### Requirement: Asset requests by key

Scene components SHALL request every visual asset by a stable asset key and MUST NOT reference model file paths directly. The supported key set SHALL be exactly: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`, `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`. Resolving a supported key SHALL always produce a renderable asset, whether themed or procedural.

#### Scenario: Supported key resolves to a renderable asset
- **WHEN** a scene component requests the key `tile.forest`
- **THEN** the theme layer returns a renderable asset for that key
- **AND** the requesting component does not need to know whether it is a themed model or a procedural fallback

#### Scenario: Scene code contains no model file paths
- **WHEN** the client source outside the theme layer and theme manifests is inspected
- **THEN** it contains no references to model (GLB) file paths

### Requirement: Theme manifest

A theme SHALL be described by a manifest that declares a theme identifier, a license/source declaration for its assets, and a mapping from asset keys to GLB model files. Each mapping entry SHALL name one GLB file and SHALL accept optional transform overrides (see "Per-asset transform overrides"). A manifest SHALL NOT be required to map every key; unmapped keys use the procedural fallback. The client SHALL ship a default theme.

#### Scenario: Mapped key uses the theme model
- **WHEN** the active theme maps `piece.city` to a GLB file that loads successfully
- **THEN** requests for `piece.city` render that model

#### Scenario: Partial manifest is valid
- **WHEN** the active theme maps only `tile.forest` and `tile.hills`
- **THEN** those two keys render their theme models
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

Every themed model SHALL follow this contract: Y-up; 1 unit equals the hex circumradius (center-to-corner distance). Hex models (`tile.*`, `sea`) SHALL be pointy-top, with the origin at the hex center and the top surface at y=0. Piece, token, harbor and robber models (`piece.*`, `token`, `harbor.*`) SHALL have the origin at the base center and rest on y=0. The theme layer SHALL place assets assuming this contract, and procedural fallbacks SHALL follow the same contract, so swapping a themed model for its fallback (or vice versa) does not move or resize the asset's placement.

#### Scenario: Conforming hex model aligns with the board
- **WHEN** a hex model that follows the contract is placed at a hex position
- **THEN** its corners coincide with the corners of the neighboring hexes
- **AND** its top surface is at the board's surface height

#### Scenario: Conforming piece rests on the surface
- **WHEN** a `piece.settlement` model that follows the contract is placed on an intersection
- **THEN** its base sits on the board surface with no gap and no sinking

#### Scenario: Fallback and themed model share placement
- **WHEN** a key switches from its procedural fallback to its loaded themed model
- **THEN** the asset stays at the same position and footprint on the board

### Requirement: Per-asset transform overrides

A manifest entry SHALL accept optional overrides for scale, rotation and offset. When present, the overrides SHALL be applied to that model on top of the model contract, and SHALL affect only that key in that theme. When absent, the model SHALL be used as authored.

#### Scenario: Scale override is applied
- **WHEN** the manifest entry for `piece.robber` declares a uniform scale override of 0.5
- **THEN** the robber renders at half its authored size
- **AND** no other key's size changes

#### Scenario: No override means authored transform
- **WHEN** a manifest entry declares no overrides
- **THEN** the model renders with its authored scale, rotation and origin

### Requirement: Procedural fallback for every key

Every supported asset key SHALL have a built-in procedural representation that requires no model files (for example, a hex prism colored per terrain type for `tile.*`). The procedural fallback SHALL be rendered when the active theme does not map the key, while the mapped model is loading, or when the mapped model fails to load or parse. The procedural fallbacks for different terrain and harbor keys SHALL be visually distinguishable from one another. The game SHALL remain fully playable with zero model files present.

#### Scenario: Zero model files
- **WHEN** the client runs with a theme that maps no keys, or with all model files absent
- **THEN** every board element and piece renders using procedural fallbacks
- **AND** all game interactions remain available

#### Scenario: Fallback while loading
- **WHEN** a mapped model has not finished loading
- **THEN** the procedural fallback for that key is shown
- **AND** it is replaced by the themed model once loading succeeds

#### Scenario: Terrains are distinguishable in fallback
- **WHEN** all six `tile.*` keys render as procedural fallbacks
- **THEN** each terrain type has a distinct appearance

### Requirement: Load failure handling

A model that fails to load or parse MUST NOT crash or blank the scene. The theme layer SHALL render that key's procedural fallback instead and SHALL emit a warning that names both the asset key and the theme identifier. A failure for one key SHALL NOT affect other keys.

#### Scenario: Missing model file
- **WHEN** the active theme `diorama` maps `tile.hills` to a file that returns a not-found error
- **THEN** `tile.hills` renders its procedural fallback
- **AND** a warning naming `tile.hills` and `diorama` is emitted
- **AND** the rest of the scene continues to render

#### Scenario: Corrupt model file
- **WHEN** a mapped file is not a valid GLB
- **THEN** that key renders its procedural fallback and a warning naming the key and theme is emitted

### Requirement: Manifest validation

The theme layer SHALL validate the active manifest before using it. Entries whose key is not in the supported key set SHALL be ignored, with a warning naming the unknown key; the remaining entries SHALL still be used. A manifest that fails validation as a whole (malformed structure, missing theme identifier, missing license/source declaration, or an entry with an invalid file reference or invalid override values) SHALL NOT be used: every key SHALL render its procedural fallback, and an error-level message naming the theme and the validation failure SHALL be emitted.

#### Scenario: Unknown key is ignored
- **WHEN** the manifest contains an entry for `piece.knight`
- **THEN** that entry is ignored and a warning naming `piece.knight` is emitted
- **AND** all valid entries in the manifest are still used

#### Scenario: Invalid manifest falls back entirely
- **WHEN** the active manifest is structurally malformed or lacks a license/source declaration
- **THEN** every key renders its procedural fallback
- **AND** an error-level message naming the theme and the reason is emitted
- **AND** the scene does not crash

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

The project SHALL provide a theme validation check, runnable from the command line and in CI, that inspects every model file referenced by shipped theme manifests. The check SHALL warn for any model file that is not a compressed GLB or whose size exceeds 300 KB, naming the theme, key and file size. Exceeding the budget SHALL NOT fail the check and SHALL NOT prevent the model from loading at runtime. The check SHALL fail if a manifest references a file that does not exist.

#### Scenario: Oversized model produces a warning
- **WHEN** the validation check runs and `tile.mountains` in the default theme references a 450 KB GLB
- **THEN** a warning naming the theme, `tile.mountains` and the file size is reported
- **AND** the check still passes
- **AND** the model still loads at runtime

#### Scenario: Missing referenced file fails the check
- **WHEN** a shipped manifest references a model file that does not exist in the repository
- **THEN** the validation check fails and names the theme, key and file

### Requirement: Licensing guard

Every shipped theme SHALL contain only original or permissively licensed assets (for example CC0), and its manifest SHALL declare the license and source of its assets. Files from the repository's `assets/` reference folder MUST NOT be included in the client build output, and theme manifests MUST NOT reference them. The theme validation check SHALL fail if any manifest references a file under `assets/` or lacks a license/source declaration.

#### Scenario: Reference folder excluded from build
- **WHEN** the client is built for production
- **THEN** the build output contains no file originating from the repository's `assets/` folder

#### Scenario: Manifest referencing reference art is rejected
- **WHEN** a theme manifest maps a key to a file under `assets/`
- **THEN** the theme validation check fails and names the offending theme, key and file

#### Scenario: License declaration is required
- **WHEN** a shipped theme manifest has no license/source declaration
- **THEN** the theme validation check fails and names the theme
