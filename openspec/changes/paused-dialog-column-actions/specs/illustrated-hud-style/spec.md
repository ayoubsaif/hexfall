## MODIFIED Requirements

### Requirement: Illustrated icon set
Every HUD button icon in the icon set SHALL be drawn in the same style as the avatars: flat cel-shading, thick dark outline, muted earthy palette, transparent background, 128×128 px WebP, keeping existing file names. The set SHALL include a `resume` icon (continue playing), an `end-game` icon (finish the game) and a `home` icon (back to the start screen), each visually distinct from the `pause`, `flag`, `leave` and `endturn` icons and from each other.

#### Scenario: Icon files
- **WHEN** the icon directory is checked
- **THEN** each icon name used by the HUD, including `resume`, `end-game` and `home`, has a transparent 128×128 WebP
