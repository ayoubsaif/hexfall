## ADDED Requirements

### Requirement: Button dark mask and hover light
Main buttons (default, secondary, destructive and menu styles) and HUD action buttons (the round action buttons and the action bar) SHALL show a subtle dark mask over their background at rest. When hovered with a mouse or focused with the keyboard, the mask SHALL fade out and a soft warm light SHALL glow on the button, centred under the pointer (or the button's centre for keyboard focus), within about 150 ms. While pressed, the button SHALL look darker than at rest. Disabled buttons SHALL keep the mask and SHALL NOT light up. The mask and light SHALL NOT cover the button's text, icons, badges or corner ornaments, SHALL NOT receive pointer events, and SHALL appear without transition when the user prefers reduced motion. Ghost and link buttons SHALL NOT get the mask or light. On touch input the light SHALL NOT stay on after the finger lifts.

#### Scenario: Rest and hover
- **WHEN** the pointer moves onto a main button
- **THEN** the dark mask lifts and a light glow follows the pointer across the button

#### Scenario: Disabled
- **WHEN** an action button is disabled and hovered
- **THEN** it stays masked and shows no light

#### Scenario: Content stays clear
- **WHEN** a button with an icon and a badge is at rest
- **THEN** the icon, label and badge are drawn above the mask at full contrast

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion and hovers a button
- **THEN** the mask and light change instantly

### Requirement: Leather main buttons
Main (submit) buttons SHALL use the same brown leather skin as the home page's Game Mode buttons, drawn entirely with CSS (no image files): a diagonal leather gradient, a gold edge and a thin gold inner line, with a cream label. They SHALL have slightly rounded 4 px corners, an exception to the square shape of other rectangular buttons. Pressing a main button SHALL sink it by 1 px with an inner shadow.

#### Scenario: Submit button look
- **WHEN** a main button such as Confirm is shown
- **THEN** it shows the Game Mode leather gradient, a gold edge and a gold inner line, with 4 px rounded corners
