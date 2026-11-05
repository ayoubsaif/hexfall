## ADDED Requirements

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

## MODIFIED Requirements

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
