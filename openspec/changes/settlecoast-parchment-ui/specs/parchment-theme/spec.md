## ADDED Requirements

### Requirement: Parchment design tokens

The client SHALL define its colours, fonts and surface treatments as design tokens: paper, deep paper, ink, muted ink, forest green, leather brown and gold. Every HUD surface and shared UI primitive SHALL take its colours from these tokens, and the HUD SHALL NOT use the translucent dark panel style. Text SHALL meet a 4.5:1 contrast ratio against its surface and interactive component boundaries and focus rings SHALL meet 3:1.

#### Scenario: Token contrast
- **WHEN** each text token is paired with each surface token it is used on
- **THEN** the pair has a contrast ratio of at least 4.5:1

#### Scenario: No dark glass left
- **WHEN** any screen (start, lobby, game HUD, dialogs, settings) is shown
- **THEN** its panels use paper surfaces with ink text, and none uses the previous translucent dark HUD background

### Requirement: Typography

Headings, titles and the game name SHALL be set in Cormorant Garamond; body text, labels and controls SHALL be set in Manrope. Both SHALL be served from the app's own origin, with a serif or sans-serif system fallback while loading. Small uppercase eyebrow labels SHALL be letter-spaced and SHALL NOT be smaller than 11 px.

#### Scenario: Fonts self-hosted
- **WHEN** the start screen loads
- **THEN** no font request goes to a third-party origin
- **AND** the title renders in Cormorant Garamond and the body in Manrope

### Requirement: Parchment panels, frames and buttons

Panels, dialogs and sheets SHALL render as paper with a hairline inner border and soft shadow. Option tiles and dialogs SHALL carry corner brackets drawn in CSS. The primary button SHALL be a dark leather plaque with a cream serif label; secondary buttons SHALL be paper tiles; the selected option in a group SHALL be filled forest green with cream text and exposed to assistive technology through `aria-pressed` or `aria-checked`. Disabled controls SHALL be visibly dimmed and not focusable by pointer. Touch targets SHALL be at least 40 × 40 CSS pixels on mobile.

#### Scenario: Selected option
- **WHEN** the player picks one option in a tile group
- **THEN** that tile is forest green with cream text and exposes its selected state to assistive technology
- **AND** the others stay paper

#### Scenario: Keyboard focus
- **WHEN** a button or tile receives keyboard focus
- **THEN** a visible focus ring of at least 3:1 contrast is drawn around it

### Requirement: Start screen composition

The start screen SHALL be a centred parchment card with: the game title in serif, a one-line description, saved-games entry (when any exist), the name field, and the create-room and join-room controls, all with the existing behaviour and validation. It SHALL NOT show features the game does not have (AI opponents, online or friends counts, music toggle, free-to-play badge).

#### Scenario: Existing flows unchanged
- **WHEN** a valid name is entered and "Create room" is activated
- **THEN** a room is created exactly as before the restyle

#### Scenario: Narrow phone
- **WHEN** the start screen is shown at 360 × 740 px
- **THEN** the card fits the viewport width, scrolls vertically if needed, and has no horizontal scroll

### Requirement: Splash screen

While the theme and first models are loading, the app SHALL show a splash: a parchment page with a double hairline border, an eyebrow "Gather · Trade · Build", the title, a tagline, a progress bar and a field-guide tip. Tips SHALL rotate automatically every 6 seconds, and the player SHALL be able to pause rotation and advance to the next tip. The splash SHALL disappear as soon as loading finishes and SHALL NOT delay an already-ready app. All splash text SHALL be translated.

#### Scenario: Loading
- **WHEN** the app starts and assets are still loading
- **THEN** the splash shows the title, a progress bar and the first tip

#### Scenario: Tip controls
- **WHEN** the player presses pause, then next
- **THEN** rotation stops and the next tip is shown

#### Scenario: Reduced motion
- **WHEN** the motion preference is reduce
- **THEN** the splash shows no animation and tips do not auto-rotate

### Requirement: In-game HUD legibility over the board

HUD pieces floating over the 3D board SHALL use paper surfaces at no less than 90% opacity so text stays readable over any terrain. The board SHALL remain a full-screen background and the responsive layout rules SHALL NOT change. Resource card frames and player colours SHALL keep their meaning and SHALL meet 3:1 contrast against the paper surface.

#### Scenario: Readable over the ocean
- **WHEN** the game HUD is shown at 1440 × 900 px
- **THEN** player panels, hand, dice readout and log text meet 4.5:1 contrast against their surfaces

#### Scenario: Layout unchanged
- **WHEN** the HUD is shown at 360 × 740, 900 × 500 and 1440 × 900 px
- **THEN** the arrangement matches the existing responsive layout with no overlap or horizontal scroll

### Requirement: Ambient background

The aurora blobs SHALL be removed. Outside the island the background SHALL be a static dark vignette, with no filters and no animation.

#### Scenario: No ambient animation
- **WHEN** the game is shown
- **THEN** the background has no running animation
