## Purpose

Give the board scene a warm, soft, painterly atmosphere (golden-hour grading, vignette, contact shadows) that the user can turn off and that scales with graphics quality.

## ADDED Requirements

### Requirement: Warm color grade
When screen filters are on, the rendered board scene SHALL be color graded toward a warm golden-hour look: warmer highlights, slightly raised saturation, and cool teal shadows over water, while keeping the six terrain types, every player color and the red 6/8 number chips distinguishable from one another.

#### Scenario: Grade applied
- **WHEN** screen filters are on
- **THEN** the scene is rendered with the warm grade

#### Scenario: Player colors stay distinct
- **WHEN** pieces of every player color are shown with the grade applied
- **THEN** each player color remains distinguishable from the others and from the terrain

### Requirement: Vignette
When screen filters are on, the edges and corners of the board view SHALL be gently darkened. The vignette SHALL NOT darken the center of the view and SHALL NOT affect HUD elements.

#### Scenario: HUD not darkened
- **WHEN** the vignette is shown
- **THEN** HUD panels and buttons keep their normal colors

### Requirement: Ambient occlusion by quality
When screen filters are on and the graphics quality is Medium or High, the scene SHALL show ambient occlusion (soft contact shadows where pieces, rocks and props meet the ground). On Low quality, ambient occlusion SHALL be off; the grade and vignette SHALL still apply.

#### Scenario: Low quality
- **WHEN** graphics quality is Low and screen filters are on
- **THEN** the grade and vignette are shown and ambient occlusion is not

#### Scenario: High quality
- **WHEN** graphics quality is High and screen filters are on
- **THEN** ambient occlusion is shown

### Requirement: Screen filters switch
Settings > Graphics SHALL offer a "Screen filters" switch, on by default, saved with the other preferences. Turning it off SHALL remove the grade, vignette and ambient occlusion immediately without reloading.

#### Scenario: Turn filters off
- **WHEN** the user turns Screen filters off
- **THEN** the board renders without grade, vignette and ambient occlusion
- **AND** the choice is kept after a reload

### Requirement: Filters do not break interaction
Screen filters SHALL NOT change what is picked by a click or tap, SHALL NOT change the board framing, and SHALL keep the 3D dice, labels and chips readable.

#### Scenario: Picking unchanged
- **WHEN** the user clicks a legal settlement spot with filters on
- **THEN** the same spot is picked as with filters off
