# view-controls-input-theme Specification

## Purpose

Detect mouse, touch and touchpad input and theme the view controls: Google Maps style for touch and touchpad, the leather bar for mouse.

## Requirements

### Requirement: Input kind detection
The client SHALL track the active input kind as `mouse`, `touch` or `touchpad`. It SHALL start as `touch` when the primary pointer is coarse, otherwise `mouse`. It SHALL switch to `touch` on touch pointer events, to `mouse` on mouse pointer events or a wheel event classified as a mouse-wheel zoom, and to `touchpad` on a wheel event classified as a touchpad pan or pinch. The kind SHALL persist until another kind is detected.

#### Scenario: Touchpad scroll
- **WHEN** a touchpad two-finger scroll wheel event is received on the board while the kind is `mouse`
- **THEN** the input kind becomes `touchpad`

#### Scenario: Touch tap
- **WHEN** a pointer event with type touch occurs while the kind is `mouse`
- **THEN** the input kind becomes `touch`

### Requirement: Google Maps style for touch and touchpad
While the input kind is `touch` or `touchpad`, the view controls SHALL use a Google Maps-like style: white rounded buttons, grey icons, soft shadow, zoom in and zoom out stacked vertically in one joined control with a hairline divider, the three view presets as separate round buttons, and the active preset tinted blue. The zoom slider and the percent text SHALL NOT be shown. Zoom and presets SHALL behave exactly as in the mouse theme.

#### Scenario: Touchscreen device
- **WHEN** the input kind is `touch`
- **THEN** `zoom-in` is stacked above `zoom-out` in a white joined control and no zoom slider is shown

#### Scenario: Zoom button works
- **WHEN** the user taps `zoom-in` in the maps style
- **THEN** the zoom increases by the same step as in the mouse theme

### Requirement: Mouse style unchanged
While the input kind is `mouse`, the view controls SHALL keep the existing leather and gold bar with zoom out, slider, zoom in, percent and the three presets, apart from the thinner sizing.

#### Scenario: Mouse user
- **WHEN** the input kind is `mouse`
- **THEN** the zoom slider and percent text are shown and the bar uses the leather/gold style

### Requirement: Theme switch keeps layout
Switching the theme SHALL NOT move the player container and SHALL keep the view controls anchored directly below it.

#### Scenario: Switch while playing
- **WHEN** the input kind changes from `mouse` to `touchpad` during a game
- **THEN** the player container position is unchanged and the controls remain under it

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
