## ADDED Requirements

### Requirement: Toast placement
Toasts SHALL be shown in a stack at the bottom-right of the game view, directly above the floating action buttons (the cluster that holds Trade), right-aligned and newest nearest the buttons. The stack SHALL NOT be placed at the center of the screen and SHALL NOT cover the hand, the action buttons or the status pill, on desktop, tablet or phone layouts. Its position SHALL follow the measured hand and button heights. Outside a game the stack SHALL sit in the same corner.

#### Scenario: Desktop
- **WHEN** a toast appears during a game on a desktop screen
- **THEN** it is drawn at the bottom-right, above the action buttons, and the board center stays unobscured

#### Scenario: Phone portrait
- **WHEN** a toast appears on a portrait phone
- **THEN** it is drawn right-aligned above the action buttons and does not overlap the hand

#### Scenario: Buttons grow
- **WHEN** the action cluster gets taller (more buttons shown)
- **THEN** the toast stack moves up so it does not overlap them

### Requirement: Toast behavior
Toasts SHALL never block input except through their own dismiss button, SHALL be announced politely to assistive technology, and at most 3 SHALL be visible at once; a newer toast SHALL push out the oldest. A toast about a player SHALL show that player's avatar before the text.

#### Scenario: Cap
- **WHEN** a fourth toast arrives while three are visible
- **THEN** the oldest is removed and three remain

#### Scenario: Player toast
- **WHEN** a toast reports that a player stole a card
- **THEN** it shows that player's avatar next to the text

#### Scenario: Click through
- **WHEN** the user clicks the board area beside a toast
- **THEN** the click reaches the board
