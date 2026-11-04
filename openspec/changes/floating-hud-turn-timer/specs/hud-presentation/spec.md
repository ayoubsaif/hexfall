## MODIFIED Requirements

### Requirement: Responsive HUD layout

The HUD SHALL provide three layouts selected by viewport width:
- mobile: below 640 px;
- tablet: 640–1023 px;
- desktop: 1024 px and wider.

Any viewport shorter than 600 px SHALL use the compact arrangement: compact panels, the log as a drawer, and smaller hand cards.

In every layout:
- The board SHALL be a full-screen background behind the HUD, fitted to the whole viewport. It SHALL NOT be resized or moved around the HUD.
- The hand (resource cards, then any development cards) SHALL sit at the bottom center of the screen with no panel around it. Each card SHALL be about half hidden below the bottom edge.
- The floating action buttons SHALL sit at the bottom-right, and the turn status pill SHALL float just above the hand.
- All HUD controls that are available in the current game state SHALL be visible or reachable by one tap or click.
- HUD controls SHALL NOT overlap one another, apart from a hovered or focused hand card rising over its neighbors.
- The HUD SHALL NOT cause horizontal page scrolling.

When the hand does not fit the width, its cards SHALL overlap each other horizontally rather than wrap or scroll. In the mobile layout:
- the event log SHALL open as a drawer;
- the player panels SHALL show compact rows;
- interactive controls, including the floating buttons, SHALL be at least 40 × 40 CSS pixels.

#### Scenario: Narrow phone
- **WHEN** the game HUD is shown at 360 × 740 px during the viewer's turn
- **THEN** the floating buttons, the dice and every hand card are reachable without horizontal scrolling
- **AND** no two HUD controls overlap
- **AND** the event log is closed and opens as a drawer from its toggle

#### Scenario: Desktop
- **WHEN** the game HUD is shown at 1440 × 900 px
- **THEN** the player panels, the event log, the floating buttons and the hand are visible at the same time without opening a drawer

#### Scenario: Short landscape screen
- **WHEN** the viewport is 900 × 500 px
- **THEN** the player panels show compact rows, the event log opens as a drawer, the hand peeks from the bottom edge with compact cards, and the floating buttons sit at the bottom-right over the full-screen board

#### Scenario: Hand peeks from the edge
- **WHEN** the viewer holds cards and nothing in the hand has hover or focus
- **THEN** each hand card shows its upper half above the bottom edge, with its name, icon or art and count visible, and a soft shadow behind the cards instead of a panel

#### Scenario: Card rises on focus
- **WHEN** the viewer hovers over a hand card or moves keyboard focus onto it
- **THEN** that card rises fully above the bottom edge

### Requirement: Development cards as cards

The viewer's development cards SHALL be shown in the same card frame and the same half-off-edge hand layout as resource cards, after the resource cards and separated from them by a small gap. They SHALL appear only while the viewer holds at least one. Each card SHALL show an icon and the card's title, with a count when more than one is held. Cards that can't be played right now, such as one bought this turn, SHALL look visibly disabled, and their accessible description SHALL say why. Playing a card SHALL remain a single activation of the card.

#### Scenario: Knight bought this turn
- **WHEN** the viewer holds one Knight bought this turn
- **THEN** the Knight card is shown disabled
- **AND** its accessible description says it can be played from the next turn

#### Scenario: First development card bought
- **WHEN** the viewer, holding no development cards, buys a Monopoly
- **THEN** a Monopoly card appears in the hand after the resource cards, in the same peek layout

### Requirement: Minimal motion

HUD motion SHALL be limited to these CSS transitions, each lasting at most 200 ms:
- an interactive card lifts on hover or keyboard focus;
- a hand card rises above the bottom edge on hover or focus;
- cards slide into the hand when gained;
- cards fade when spent or discarded;
- dialogs and drawers fade and scale in;
- the your-turn overlay fades in and out;
- the dice move between their dock and the center.

The only exception is the dice throw (see game-hud "Dice display"). It SHALL last at most 1.2 s, SHALL play once per roll, and SHALL end on the rolled faces.

No HUD element SHALL animate continuously. Turn countdowns SHALL change in steps no more than once per second, not by a running animation. When the user prefers reduced motion, all HUD transitions and animations SHALL be disabled, including the dice throw. State changes SHALL then appear immediately.

#### Scenario: Gaining a card
- **WHEN** the viewer receives one grain from production
- **THEN** the grain card enters the hand with a slide lasting at most 200 ms

#### Scenario: Dice throw
- **WHEN** a roll arrives as an incremental update
- **THEN** the dice animation lasts at most 1.2 s, plays once, and does not repeat

#### Scenario: Countdown has no running animation
- **WHEN** a countdown is shown for 5 s
- **THEN** it changes at most 5 times and no CSS animation or transition runs on it in between

#### Scenario: Reduced motion
- **WHEN** the user's system prefers reduced motion and the viewer gains a card, opens a dialog, sees a roll or starts their turn
- **THEN** the card, dialog, dice and your-turn overlay appear in their final state without any transition
