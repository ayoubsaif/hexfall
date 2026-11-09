## MODIFIED Requirements

### Requirement: Asset kinds

Every supported asset key SHALL have exactly one kind:
- **Flat** keys: `tile.forest`, `tile.pasture`, `tile.fields`, `tile.hills`, `tile.mountains`, `tile.desert`, `sea`, `token`, `harbor.generic`, `harbor.brick`, `harbor.grain`, `harbor.lumber`, `harbor.ore`, `harbor.wool`. These are drawn as flat shapes on the board plane, optionally textured with an image.
- **Model** keys: `piece.road`, `piece.settlement`, `piece.city`, `piece.robber`, `dice.die`, `prop.boat`, `prop.jetty`, `prop.boulder`, `prop.cliff`, `prop.wall`, `prop.tree`, `prop.bush`. These are 3D objects, optionally loaded from a GLB model.

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

### Requirement: Licensing guard

Every shipped theme SHALL contain only original or permissively licensed assets. Allowed licenses SHALL be exactly `CC0-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-3.0`, `CC-BY-SA-4.0`, `MIT` and `LicenseRef-BlendKit-RF` (BlendKit's Royalty Free license, for models embedded in the game, never redistributed on their own). Non-commercial (`-NC`) and no-derivatives (`-ND`) licenses SHALL be rejected. The manifest SHALL declare the license and source of its assets. Assets under an attribution-required license (every allowed license except `CC0-1.0`) SHALL also be covered by a credit (see "Asset credits"). Files from the repository's `assets/` reference folder MUST NOT be included in the client build output, and theme manifests MUST NOT reference them. The theme validation check SHALL fail if any manifest references a file under `assets/`, lacks a license/source declaration, declares a license outside the allowed set, or maps an attribution-licensed asset without a credit.

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

#### Scenario: BlendKit model with a credit is accepted
- **WHEN** a credit declares the license `LicenseRef-BlendKit-RF` for `prop.tree`
- **THEN** the theme validation check accepts it

#### Scenario: BlendKit model without a credit is rejected
- **WHEN** `prop.tree` maps a BlendKit model and no credit covers `prop.tree`
- **THEN** the theme validation check fails and names the theme and the uncovered key
