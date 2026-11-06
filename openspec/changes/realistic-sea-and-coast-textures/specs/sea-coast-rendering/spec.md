## ADDED Requirements

### Requirement: Textured sea surface

The sea SHALL be drawn as one continuous water surface around the island, shaded from a coast field that is baked once when the board is created and then only read per pixel (the island never moves, so the shore distance SHALL NOT be recomputed per pixel). It SHALL use a seamless tileable noise texture (caustic and ripple detail) at two different scales and scroll directions, so that no tile repetition or seam is visible from the default camera. The water colour SHALL come from a depth gradient (sand, luminous turquoise, deep blue), not from a painted water image.

#### Scenario: Depth ramp
- **WHEN** a board is rendered
- **THEN** water within about 1.5 hex radii of land is visibly lighter and more turquoise than water beyond 3.5 hex radii

#### Scenario: No visible seams
- **WHEN** the default camera frames the board
- **THEN** no straight texture seam or obvious repeating tile pattern is visible in the water

### Requirement: Coast band

The coast SHALL show a continuous gradient from beach sand at the land edge, through a wet-sand band whose waterline moves slowly with the tide, to translucent shallows where sand shows through the water, then foam at the surf line. There SHALL be no hard single-pixel-wide foam outline. The band SHALL follow the island outline, including concave corners.

#### Scenario: Sand shows through shallows
- **WHEN** a coastal area is viewed
- **THEN** sand texture is visible through the shallow water and fades out with distance from land

#### Scenario: Crisp contour lines
- **WHEN** the coast is viewed at default zoom
- **THEN** thin hard-edged white wave lines follow the contours of the coast field, roll toward the beach, are thicker near it than offshore, and are broken into segments by noise
- **AND** their edges stay one pixel wide at any zoom

#### Scenario: Soft shoreline
- **WHEN** the waterline is viewed at default zoom
- **THEN** it shows a soft foam edge blended into the water and sand, not a hard outline

#### Scenario: Irregular shoreline
- **WHEN** the coast is viewed at default zoom
- **THEN** the beach width varies along the coast with bays, headlands and ragged edges
- **AND** neither the sand edge, the foam nor the depth bands trace a regular offset of the hex outline

#### Scenario: Outline follows land
- **WHEN** the island has a concave coast corner
- **THEN** the coast band wraps the corner with no gap or overlap

### Requirement: Procedural fallback

The sea and coast SHALL render without any texture file. While textures load, or if any texture fails to load or decode, the sea SHALL use the procedural look (flat depth ramp, procedural noise detail, foam) and the game SHALL stay fully playable. A texture failure SHALL NOT produce an error screen or block rendering.

#### Scenario: Textures missing
- **WHEN** the sea and coast texture files are absent
- **THEN** the board renders with the procedural sea and coast
- **AND** no error is shown to the player

#### Scenario: Textures loading
- **WHEN** the page has just loaded and textures are still downloading
- **THEN** the procedural sea is shown and switches to the textured sea once loaded, without layout change

### Requirement: Reduced motion

When the user prefers reduced motion, the sea and coast SHALL be still: no texture scrolling, caustic movement, wave travel or tide movement.

#### Scenario: Reduced motion on
- **WHEN** reduced motion is preferred
- **THEN** two frames captured one second apart show identical sea and coast pixels

### Requirement: Performance budget

The sea and coast textures SHALL total no more than 300 KB, and SHALL be loaded lazily without blocking the first board render. The water shader SHALL use at most 3 texture fetches per fragment, and SHALL use a reduced-cost path on low-capability devices.

#### Scenario: Texture size
- **WHEN** the asset check runs
- **THEN** it fails if the sea and coast textures total more than 300 KB

#### Scenario: First render not blocked
- **WHEN** the page loads on a slow connection
- **THEN** the board and HUD are interactive before the sea textures finish downloading
