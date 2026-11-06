## ADDED Requirements

### Requirement: View control shortcuts
Zoom in, zoom out and the view-preset cycle SHALL be reachable by the keyboard shortcuts of `keyboard-shortcuts`, in both the mouse and the touch/touchpad themes. The zoom buttons and preset buttons SHALL include their key in the `title`. Zoom shortcuts SHALL use the same step as the buttons and stop at the zoom limits.

#### Scenario: Zoom key
- **WHEN** the user presses `+` below the maximum zoom
- **THEN** the zoom increases by the button step

#### Scenario: At limit
- **WHEN** the zoom is at maximum and the user presses `+`
- **THEN** the zoom is unchanged

#### Scenario: Cycle view
- **WHEN** the preset is `free` and the user presses `V`
- **THEN** the preset becomes `top`, then `diagonal`, then `free` on later presses
