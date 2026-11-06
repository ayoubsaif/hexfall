# compact-player-panels Specification

## Purpose

Define the compact single-surface player panel in the game HUD: icon stat chips, illustrated icons, special-card medals, owner-only hidden VP and the responsive layout.

## Requirements

### Requirement: Compact single-surface panel
Each player panel SHALL be one paper card containing the avatar, the name and the four stat chips, without a separate header band or badge row. The seat color SHALL remain visible as a left bar.

#### Scenario: Panel structure
- **WHEN** a game view is shown
- **THEN** each seat renders one `player-panel` with avatar, name and four chips, and no text-label row

#### Scenario: State markers kept
- **WHEN** a seat is active, is the viewer, or is offline
- **THEN** the panel keeps `data-active`, `data-own`, the You badge and the offline badge, and shows the countdown for a waited-on seat

### Requirement: Icon stat chips with larger type
Each panel SHALL show victory points, resource cards, development cards and played knights as an icon plus a number. Numbers SHALL be at least 16 px on desktop and at least 14 px on phones and short screens. The number element SHALL keep `data-stat` set to `vp`, `cards`, `dev` or `knights`.

#### Scenario: Chip content
- **WHEN** a panel is rendered
- **THEN** four chips appear in the order vp, cards, dev, knights, each with an icon and a number

#### Scenario: Accessible labels
- **WHEN** a chip is read by a screen reader or hovered
- **THEN** its full localized label (English or Spanish) is available as text and tooltip, even though no visible text label is shown

#### Scenario: No abbreviations
- **WHEN** the screen is a phone or short viewport
- **THEN** no abbreviated labels such as "PV" or "Cab" are shown

### Requirement: Illustrated stat icons
The vp, hand and knight icons SHALL exist as transparent 128 px WebP files in `/ui/icons/` in the embossed-gold painted style with a thick dark outline, and development cards SHALL use the existing `devcard` icon. The hand icon SHALL be visually distinct from the development card icon.

#### Scenario: Icons available
- **WHEN** `GameIcon` is asked for `vp`, `hand` or `knight`
- **THEN** it loads `/ui/icons/<name>.webp` with no failed request

#### Scenario: Legible at small size
- **WHEN** an icon is shown at 16 px on paper or on leather
- **THEN** its silhouette is distinguishable from the other three stat icons

### Requirement: Special-card medals
Longest Road and Largest Army holders SHALL show a small gold-ringed medal (road and knight icon) at the avatar corner instead of a text badge. Each medal SHALL have a tooltip and screen-reader text.

#### Scenario: Holder shows medal
- **WHEN** a seat holds Longest Road
- **THEN** its panel shows the road medal and no text badge

#### Scenario: Nobody holds a card
- **WHEN** no seat holds Largest Army
- **THEN** no army medal is shown on any panel

### Requirement: Hidden VP shown only to owner
The viewer's own panel SHALL show hidden victory points as a gold "+n" beside the VP chip when n is greater than zero. Other panels SHALL never show hidden VP.

#### Scenario: Own hidden VP
- **WHEN** the viewer holds 2 hidden VP
- **THEN** their VP chip shows "+2" in gold with the hidden-VP tooltip

#### Scenario: Opponent hidden VP
- **WHEN** another seat's panel is rendered
- **THEN** no hidden VP is shown

### Requirement: Compact responsive layout
Panels SHALL be shorter than the previous three-band layout on desktop. On phones and short screens the avatar SHALL shrink and chips SHALL lay out in a 2×2 grid. Four panels SHALL fit across a 360 px viewport without horizontal scroll.

#### Scenario: Phone width
- **WHEN** the viewport is 360 px wide with four seats
- **THEN** all four panels fit on one row with 2×2 chips and no horizontal scroll
