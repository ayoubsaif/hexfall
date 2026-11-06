## ADDED Requirements

### Requirement: Mouse camera controls unchanged

With a mouse, the camera SHALL orbit on left-button drag, pan on right-button drag and zoom on a notched wheel, within the existing distance and angle limits.

#### Scenario: Right-drag pans
- **WHEN** a mouse user drags with the right button
- **THEN** the camera target pans in the screen plane

### Requirement: Touchpad two-finger pan

On a touchpad, a two-finger scroll over the board SHALL pan the camera (the equivalent of right-button drag), and a pinch (wheel event with `ctrlKey`) SHALL zoom. The board canvas SHALL prevent the page from scrolling or zooming for these gestures. Panning SHALL stay within the camera limits. Settings SHALL offer an override that makes plain wheel events zoom instead (mouse-wheel mode); the default SHALL detect touchpads automatically.

#### Scenario: Two-finger scroll pans
- **WHEN** a touchpad two-finger scroll of dx=20, dy=30 (pixel deltas) happens over the canvas
- **THEN** the camera target pans and the page does not scroll

#### Scenario: Pinch zooms
- **WHEN** a pinch produces a wheel event with ctrlKey and deltaY=-10
- **THEN** the camera moves closer, within `minDistance`, and the browser page zoom does not change

#### Scenario: Notched wheel still zooms
- **WHEN** a wheel event with `deltaMode` lines (or a large integer deltaY) arrives and the setting is auto
- **THEN** the camera zooms instead of panning

#### Scenario: Override
- **WHEN** the user selects mouse-wheel mode in settings and scrolls with a touchpad
- **THEN** scrolling zooms

#### Scenario: Scroll outside the canvas
- **WHEN** the user scrolls over the log drawer or a dialog
- **THEN** that panel scrolls normally and the camera does not move

### Requirement: Touchscreen gestures

On a touchscreen, one finger dragging on the board SHALL orbit the camera, and two fingers SHALL pan (moving together) and zoom (pinching) at once. The canvas SHALL not let the browser scroll, zoom or navigate during these gestures. Twisting two fingers SHALL NOT rotate the camera.

#### Scenario: One finger orbits
- **WHEN** one finger drags across the board
- **THEN** the camera orbits within its limits

#### Scenario: Two fingers pan and zoom
- **WHEN** two fingers move together and apart on the board
- **THEN** the camera pans and zooms accordingly, and the page does not zoom

#### Scenario: Camera works under a hand-held HUD
- **WHEN** a finger starts a drag on an HUD button
- **THEN** the camera does not move

### Requirement: Tap is not a drag

A pointer movement under a threshold (3 px for mouse and touchpad, 6 px for touch) SHALL count as a tap or click, so selecting a hex, intersection, path or piece still works. A gesture that involved two fingers SHALL NOT end in a selection on release.

#### Scenario: Slightly moving tap selects
- **WHEN** a finger taps an intersection target and drifts 4 px
- **THEN** the target is selected and the camera does not orbit

#### Scenario: Two-finger release selects nothing
- **WHEN** a two-finger pan ends over a build target
- **THEN** no target is selected

### Requirement: Input testing matrix

The gestures SHALL be covered by automated pointer and wheel event tests and by a manual checklist run on a precision touchpad, a Mac trackpad, a notched-wheel mouse, an Android phone and an iPhone.

#### Scenario: Matrix documented
- **WHEN** the change is implemented
- **THEN** the checklist and its results are recorded with the change
