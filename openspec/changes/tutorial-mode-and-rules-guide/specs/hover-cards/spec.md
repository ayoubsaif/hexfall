## Purpose

Provide one hover card behaviour for rich help content that works on mouse, keyboard and touch, and stop press-and-hold from selecting text anywhere in the app.

## ADDED Requirements

### Requirement: Hover card on mouse and keyboard
A hover card SHALL open after the pointer rests on its trigger for about 300 ms, or when the trigger receives keyboard focus, and SHALL close about 150 ms after the pointer leaves both trigger and card, when focus leaves, or on Escape. The pointer SHALL be able to move into the open card without closing it. The card SHALL use the parchment style with square corners, stay inside the viewport, and appear above other HUD layers without receiving the board's pointer events. Its content SHALL be reachable by assistive technology from the trigger.

#### Scenario: Hover to open
- **WHEN** the pointer rests on a trigger for 300 ms
- **THEN** the hover card opens next to the trigger

#### Scenario: Keyboard
- **WHEN** a trigger receives keyboard focus
- **THEN** the hover card opens, and pressing Escape closes it

### Requirement: Press and hold on touch
On touch input, a hover card SHALL open when the trigger is pressed and held for about 450 ms without the finger moving more than 10 px. Releasing after the card opened SHALL NOT fire the trigger's tap action. A short tap SHALL fire the trigger's normal action and SHALL NOT open the card. The card SHALL stay open after release and close on a tap anywhere outside it. Holding SHALL NOT show the system context menu, text selection, or the image/link callout.

#### Scenario: Hold to read
- **WHEN** the player holds the build road button on a phone for half a second and releases
- **THEN** the rule helper card is shown and no road placement starts

#### Scenario: Tap still acts
- **WHEN** the player taps the build road button briefly
- **THEN** road placement starts and no card opens

#### Scenario: Finger moves
- **WHEN** the finger moves more than 10 px during the hold
- **THEN** no card opens

### Requirement: No text selection in the app
The app SHALL disable text selection and the touch callout on all its surfaces (HUD, dialogs, start screen, board). Text inputs, text areas and other editable fields SHALL stay selectable and editable.

#### Scenario: Long-press a label
- **WHEN** the player long-presses a player name or a dialog heading
- **THEN** no text gets selected and no system menu appears

#### Scenario: Chat input
- **WHEN** the player selects text they typed in the chat input
- **THEN** the selection works normally
