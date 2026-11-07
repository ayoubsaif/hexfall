# illustrated-hud-style Specification

## Purpose

Define the illustrated look of the parchment HUD: ornate corner images on framed surfaces, square shapes, and one illustrated icon style matching the avatars.

## Requirements

### Requirement: Ornate corner images
Framed surfaces SHALL be decorated with illustrated corner images at all four corners instead of drawn line brackets. Dialogs, drawers and the page frame SHALL use the large brass filigree corner; cards, tiles and secondary or cancel buttons SHALL use the small grey carved-stone corner. Each corner image SHALL be a transparent WebP, available in four orientations so that the same ornament faces inward at every corner. Corners SHALL NOT receive pointer events and SHALL NOT replace the surface's own background.

#### Scenario: Dialog corners
- **WHEN** a dialog is open
- **THEN** it shows a brass corner ornament at each of its four corners, mirrored so each faces inward

#### Scenario: Card and cancel button corners
- **WHEN** a card or a cancel button is shown
- **THEN** it shows small stone corner ornaments, not CSS line brackets

#### Scenario: Small controls
- **WHEN** a control is shorter than 36 px
- **THEN** it shows no corner ornaments

### Requirement: Square shape
Dialogs, drawers, cards, tooltips, tabs, inputs and rectangular buttons SHALL have square corners. Avatars, switches, sliders, count badges and round icon buttons MAY stay round.

#### Scenario: Dialog shape
- **WHEN** a dialog is open
- **THEN** its border has no rounded corners

#### Scenario: Round exceptions
- **WHEN** an avatar or a switch is shown
- **THEN** it stays circular

### Requirement: Illustrated icon set
The 14 HUD button icons SHALL be drawn in the same style as the avatars: flat cel-shading, thick dark outline, muted earthy palette, transparent background, 128×128 px WebP, keeping their current file names.

#### Scenario: Icon files
- **WHEN** the icon directory is checked
- **THEN** each of the 14 icon names has a transparent 128×128 WebP
