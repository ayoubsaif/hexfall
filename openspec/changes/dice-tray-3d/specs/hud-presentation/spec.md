## MODIFIED Requirements

### Requirement: Minimal motion

HUD motion SHALL be limited to these CSS transitions, each lasting at most 200 ms:
- an interactive card lifts on hover or keyboard focus;
- cards slide into the hand when gained;
- cards fade when spent or discarded;
- dialogs and drawers fade and scale in.

The only exception is the dice throw (see game-hud "Dice display"). It SHALL last at most 1.2 s, SHALL play once per roll, and SHALL end on the rolled faces.

No HUD element SHALL animate continuously. When the user prefers reduced motion, all HUD transitions and animations SHALL be disabled, including the dice throw, and state changes SHALL appear immediately.

#### Scenario: Gaining a card
- **WHEN** the viewer receives one grain from production
- **THEN** the grain card enters the hand with a slide lasting at most 200 ms

#### Scenario: Dice throw
- **WHEN** a roll arrives as an incremental update
- **THEN** the dice animation lasts at most 1.2 s, plays once, and does not repeat

#### Scenario: Reduced motion
- **WHEN** the user's system prefers reduced motion and the viewer gains a card, opens a dialog or sees a roll
- **THEN** the card, dialog and dice appear in their final state without any transition
