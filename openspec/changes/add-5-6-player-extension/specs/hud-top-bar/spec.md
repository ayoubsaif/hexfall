## ADDED Requirements

### Requirement: Victory target and building window in the HUD
The HUD SHALL show the game's victory target (for example "Goal: 12 VP") so every player can see how many points win. During a Special Building Phase the HUD status SHALL name the seat whose building window is open, and the seat in that window SHALL see only build, buy and pass controls; trade and development-card controls SHALL be hidden or disabled for them.

#### Scenario: Target shown
- **WHEN** a game with target 12 is running
- **THEN** the HUD shows that 12 VP wins

#### Scenario: My building window
- **WHEN** my Special Building Phase window opens
- **THEN** the status says it is my building window, build, buy and pass controls are available, and trade and card-play controls are not

## MODIFIED Requirements

### Requirement: Fixed top player container
The game HUD SHALL show all player panels in one container pinned to the top edge of the HUD. The panels SHALL stay in a single non-wrapping row for 3 to 6 players, and the container's height SHALL NOT change when badges, countdowns, offline state or hand counts change. Long names SHALL truncate.

#### Scenario: Four players with badges
- **WHEN** a 4-player game has Longest Road, Largest Army, an offline seat and a waiting countdown shown at once
- **THEN** all four panels are in one row and the container height equals its height with none of those shown

#### Scenario: Narrow viewport
- **WHEN** the viewport is 390 px wide with 4 players
- **THEN** the panels share the row width, use compact stat labels and do not wrap or scroll the page horizontally

#### Scenario: Six players
- **WHEN** a 6-player game is shown at 390 px wide
- **THEN** all six panels are in one row and the page does not scroll horizontally
