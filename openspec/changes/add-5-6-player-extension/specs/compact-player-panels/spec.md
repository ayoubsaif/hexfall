## MODIFIED Requirements

### Requirement: Compact responsive layout
Panels SHALL be shorter than the previous three-band layout on desktop. On phones and short screens the avatar SHALL shrink and chips SHALL lay out in a 2×2 grid. Up to six panels SHALL fit across a 360 px viewport without horizontal scroll; with five or six seats on a narrow viewport each panel SHALL show at least the avatar, a truncated name and the VP chip, and the other chips MAY be hidden behind the panel's details.

#### Scenario: Phone width
- **WHEN** the viewport is 360 px wide with four seats
- **THEN** all four panels fit on one row with 2×2 chips and no horizontal scroll

#### Scenario: Six seats on a phone
- **WHEN** the viewport is 360 px wide with six seats
- **THEN** all six panels fit on one row, each shows its avatar, name and VP, and the page does not scroll horizontally

#### Scenario: Six seats on desktop
- **WHEN** the viewport is 1280 px wide with six seats
- **THEN** all six panels show every chip without wrapping
