## MODIFIED Requirements

### Requirement: Original painted tile art

The default theme SHALL map each of the six `tile.*` keys to an original painted top-down texture image. The `sea` key SHALL also map to an original texture, which MAY be rasterized from hand-written vector art. The default theme SHALL also declare original seamless textures for the continuous sea surface and the coast (water caustics and beach sand) in a `water` block of the manifest. Each image SHALL be created without using any file from the repository's `assets/` folder, or any other existing artwork, as an input, with one exception: the owner MAY supply a reference image or screenshots as style guidance (mood, palette, softness) for the sea and coast textures. Such a reference SHALL NOT be copied, traced, or used as a direct image input to a generator in a way that reproduces its content. The default theme's manifest SHALL declare how the images were made and under what license, and SHALL state when an owner-supplied style reference was used. An image SHALL be added to the default theme only after the user has approved it.

#### Scenario: Default theme ships tile textures
- **WHEN** the client runs with the default theme
- **THEN** the six terrain tiles render painted textures rather than flat colors

#### Scenario: Provenance is declared
- **WHEN** the default theme manifest is inspected
- **THEN** its license/source declaration states that the tile images are original and how they were produced

#### Scenario: Sea and coast textures declared
- **WHEN** the default theme manifest is inspected
- **THEN** its `water` block names the seamless sea and coast texture files
- **AND** its provenance declaration states that they are original and were generated using an owner-supplied style reference

#### Scenario: Reference is not a shipped asset
- **WHEN** the repository assets are inspected
- **THEN** the owner-supplied reference image is not shipped in the client and no shipped texture is a copy or trace of it
