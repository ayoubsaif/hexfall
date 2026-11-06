## MODIFIED Requirements

### Requirement: Dice tray readout
The HUD dice control SHALL remain the roll control, with its accessible names ("Roll dice", "Roll for order"), highlight and send-once behavior unchanged. It SHALL be drawn as a 3D dice illustration on a transparent background: no card, panel, border or ring around the illustration, only a soft shadow so it reads on water and sand. It SHALL dock in the bottom control band (see `hud-compact-controls`), and during the your-turn focus the same illustration SHALL be shown enlarged at the center of the screen, also without a card. It SHALL show the total of the latest roll as text beside the illustration, in the warning color for 7, and nothing before the first roll of the turn. The latest roll SHALL be available as text, for example "Rolled 3 and 4, total 7", and SHALL be announced once the 3D dice come to rest (immediately for a static display). When the control is ready to roll it SHALL be visibly highlighted (glow or outline of the illustration) and keyboard focus SHALL show a visible focus ring. Since the dice now roll on the board, the your-turn focus (which dims the board) SHALL close as soon as the viewer's own roll arrives, so the throw is seen undimmed.

#### Scenario: Announced on rest
- **WHEN** a roll of 3 and 4 is thrown
- **THEN** "Rolled 3 and 4, total 7" is announced when the dice come to rest, not before

#### Scenario: Focus closes before the throw
- **WHEN** the your-turn focus is open and the viewer's roll of 2 and 2 arrives
- **THEN** the focus closes at once and the dice are thrown on the undimmed board

#### Scenario: Seven in warning color
- **WHEN** the latest roll totals 7
- **THEN** the control's total is shown in the warning color

#### Scenario: No card behind the dice
- **WHEN** the dice control is docked or centered
- **THEN** only the dice illustration and the total are drawn, with no background panel, border or ring

#### Scenario: Centered on your turn
- **WHEN** the your-turn focus opens
- **THEN** the same borderless illustration moves to the screen center, enlarged, and returns to the band when the focus closes

#### Scenario: Keyboard focus visible
- **WHEN** the dice control receives keyboard focus
- **THEN** a visible focus ring is shown around it
