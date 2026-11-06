## ADDED Requirements

### Requirement: Board canvas cursor states

The board canvas SHALL show the `grab` cursor over empty board while the camera is idle, the `grabbing` cursor for as long as the camera is being dragged, and the `pointer` cursor while the pointer is over a pickable target (build spot, robber hex). When several apply, `grabbing` SHALL win over `pointer`, and `pointer` over `grab`. The canvas SHALL restore the default cursor when camera controls are unavailable.

#### Scenario: Idle over the board
- **WHEN** the pointer rests over the board with no target under it and no button pressed
- **THEN** the cursor is `grab`

#### Scenario: Dragging the camera
- **WHEN** the user presses and drags on the board to orbit the camera
- **THEN** the cursor is `grabbing` until the button is released, then returns to `grab`

#### Scenario: Hovering a pickable target
- **WHEN** build targets are offered and the pointer is over one of them
- **THEN** the cursor is `pointer`, and it returns to `grab` when the pointer leaves the target

### Requirement: Clickable controls show a pointer cursor

Every enabled interactive HUD control (buttons, tabs, switches, selects and their options, dialog and drawer triggers and close buttons, resource and development cards, the ready dice tray, view and settings controls, links) SHALL show the `pointer` cursor on hover. Disabled interactive controls SHALL show `not-allowed`, except controls whose disabled state is informational (such as the dice tray when it is not the player's roll), which SHALL show the default cursor. Non-interactive text, panels and the connection badge SHALL NOT show a pointer cursor.

#### Scenario: Enabled button hover
- **WHEN** the pointer is over an enabled button in the HUD
- **THEN** the cursor is `pointer`

#### Scenario: Disabled button hover
- **WHEN** the pointer is over a disabled action button (for example Build when unaffordable)
- **THEN** the cursor is `not-allowed`

#### Scenario: Static text
- **WHEN** the pointer is over a player panel label or the connection badge
- **THEN** the cursor is the default arrow

### Requirement: Focus visibility preserved

Cursor changes SHALL NOT remove or replace the visible keyboard focus ring on interactive controls.

#### Scenario: Keyboard focus
- **WHEN** a HUD control receives keyboard focus
- **THEN** its focus ring is visible as before
