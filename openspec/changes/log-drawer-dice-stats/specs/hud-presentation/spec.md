## MODIFIED Requirements

### Requirement: Responsive HUD layout

The HUD SHALL provide three layouts selected by viewport width:
- mobile: below 640 px;
- tablet: 640–1023 px;
- desktop: 1024 px and wider.

Any viewport shorter than 600 px SHALL use the compact arrangement: compact panels and smaller hand cards.

In every layout:
- The board SHALL be a full-screen background behind the HUD, fitted to the whole viewport. It SHALL NOT be resized or moved around the HUD.
- The hand (resource cards, then any development cards) SHALL sit at the bottom center of the screen with no panel around it. Each card SHALL be about half hidden below the bottom edge.
- The floating action buttons SHALL sit at the bottom-right, and the turn status pill SHALL float just above the hand.
- The event log SHALL NOT be shown on the board; it SHALL open as a drawer from a "Log" toggle at the top-left, and the drawer SHALL be closed when the game HUD first appears.
- All HUD controls that are available in the current game state SHALL be visible or reachable by one tap or click.
- HUD controls SHALL NOT overlap one another, apart from a hovered or focused hand card rising over its neighbors.
- The HUD SHALL NOT cause horizontal page scrolling.

When the hand does not fit the width, its cards SHALL overlap each other horizontally rather than wrap or scroll. In the mobile layout:
- the player panels SHALL show compact rows;
- interactive controls, including the floating buttons, SHALL be at least 40 × 40 CSS pixels.

#### Scenario: Narrow phone
- **WHEN** the game HUD is shown at 360 × 740 px during the viewer's turn
- **THEN** the floating buttons, the dice and every hand card are reachable without horizontal scrolling
- **AND** no two HUD controls overlap
- **AND** the event log is closed and opens as a drawer from its toggle

#### Scenario: Desktop
- **WHEN** the game HUD is shown at 1440 × 900 px
- **THEN** the player panels, the log toggle, the floating buttons and the hand are visible at the same time
- **AND** no event log card is shown on the board until the log toggle is activated, which opens the log drawer

#### Scenario: Short landscape screen
- **WHEN** the viewport is 900 × 500 px
- **THEN** the player panels show compact rows, the event log opens as a drawer, the hand peeks from the bottom edge with compact cards, and the floating buttons sit at the bottom-right over the full-screen board

#### Scenario: Hand peeks from the edge
- **WHEN** the viewer holds cards and nothing in the hand has hover or focus
- **THEN** each hand card shows its upper half above the bottom edge, with its name, icon or art and count visible, and a soft shadow behind the cards instead of a panel

#### Scenario: Card rises on focus
- **WHEN** the viewer hovers over a hand card or moves keyboard focus onto it
- **THEN** that card rises fully above the bottom edge
