## Purpose

Define how the HUD looks and adapts to screen size: the responsive layout, resources and development cards shown as picture cards drawn from the board's own terrain art, and restrained motion that respects reduced-motion preferences. HUD behavior itself is defined by the game HUD capability.

## ADDED Requirements

### Requirement: Responsive HUD layout

The HUD SHALL provide three layouts selected by viewport width: mobile (below 640 px), tablet (640–1023 px) and desktop (1024 px and wider). Any viewport shorter than 600 px SHALL use the compact arrangement (compact panels, the log as a drawer); when such a viewport is also at least 640 px wide, the bottom stack SHALL become a right-hand column. In every layout the board SHALL be a full-screen background behind the HUD, fitted to the whole viewport, and SHALL NOT be resized or moved around the HUD panels. In every layout, all HUD controls that are available in the current game state SHALL be visible or reachable by one tap or click, SHALL NOT overlap one another, and SHALL NOT cause horizontal page scrolling. In the mobile layout the event log SHALL open as a drawer, and the player panels SHALL show compact rows. Interactive controls SHALL be at least 40 × 40 CSS pixels in the mobile layout.

#### Scenario: Narrow phone
- **WHEN** the game HUD is shown at 360 × 740 px during the viewer's turn
- **THEN** the turn controls, build controls, hand and development cards are all reachable without horizontal scrolling
- **AND** no two HUD controls overlap
- **AND** the event log is closed and opens as a drawer from its toggle

#### Scenario: Desktop
- **WHEN** the game HUD is shown at 1440 × 900 px
- **THEN** the player panels, the event log, the turn and build controls and the hand are visible at the same time without opening a drawer

#### Scenario: Short landscape screen
- **WHEN** the viewport is 900 × 500 px
- **THEN** the player panels show compact rows, the event log opens as a drawer, and the turn, build, hand and development-card controls are in a right-hand column over the full-screen board

### Requirement: Resource picture cards

Wherever the HUD shows a resource as a single item, it SHALL show that resource as a picture card. This covers:
- the own hand;
- the discard, Year of Plenty and Monopoly choices;
- the maritime trade give and receive choices;
- build-cost hints.

A resource card SHALL be a portrait card (5:7 aspect ratio) with rounded corners, a frame, the resource's card art and its name. Cards for the five resources SHALL be distinguishable without reading the name: each SHALL have its own art and its own frame color. When the viewer holds more than one card of a resource, the hand SHALL show a stack of that resource with a visible count. A resource the viewer holds none of SHALL be shown dimmed rather than hidden. Inline running text such as event log lines and toasts MAY keep text names.

#### Scenario: Hand shows cards
- **WHEN** the viewer holds 3 brick, 0 grain, 1 lumber, 2 ore and 0 wool
- **THEN** the hand shows a brick stack with count 3, a lumber card, an ore stack with count 2, and dimmed grain and wool cards

#### Scenario: Discard dialog uses cards
- **WHEN** the viewer must discard after a 7
- **THEN** each resource choice is shown as its picture card with the number to discard next to it

#### Scenario: Build-cost hint uses cards
- **WHEN** the viewer looks at the cost of a settlement
- **THEN** the cost shows small brick, lumber, wool and grain cards, one each

### Requirement: Card art from the board's terrain

The art of each resource card SHALL come from the active board's terrain tile images for the matching terrain: brick from hills, grain from fields, lumber from forest, ore from mountains and wool from pasture. The card images SHALL be produced by a project script from the committed tile images, deterministically, so they can be regenerated when the tiles change. Each card image SHALL be WebP, at most 60 KB, and at least 320 px wide. If a card image fails to load, the card SHALL still render with its frame color and name.

#### Scenario: Regenerating card art
- **WHEN** the card script runs twice on unchanged tile images
- **THEN** it produces byte-identical card images for all five resources

#### Scenario: Missing card image
- **WHEN** the image for the ore card fails to load
- **THEN** the ore card still shows its frame color and the name "Ore", and the HUD keeps working

### Requirement: Development cards as cards

The viewer's development cards SHALL be shown in the same card frame as resource cards. Each card SHALL show an icon and the card's title, with a count when more than one is held. Cards that can't be played right now, such as one bought this turn, SHALL look visibly disabled, and their accessible description SHALL say why. Playing a card SHALL remain a single activation of the card.

#### Scenario: Knight bought this turn
- **WHEN** the viewer holds one Knight bought this turn
- **THEN** the Knight card is shown disabled
- **AND** its accessible description says it can be played from the next turn

### Requirement: Card accessibility

Card images SHALL be decorative. Every card SHALL expose its resource or development card name, and its count where shown, as accessible text. Interactive cards SHALL be keyboard-focusable and SHALL show a visible focus ring. Card frames and text SHALL meet a 4.5:1 contrast ratio for the name label against its background.

#### Scenario: Screen reader reads the hand
- **WHEN** a screen reader reads a hand of 3 brick and 1 lumber
- **THEN** it announces "Brick, 3" and "Lumber, 1" (or equivalent), not image file names

### Requirement: Minimal motion

HUD motion SHALL be limited to these CSS transitions, each lasting at most 200 ms:
- an interactive card lifts on hover or keyboard focus;
- cards slide into the hand when gained;
- cards fade when spent or discarded;
- dialogs and drawers fade and scale in.

No HUD element SHALL animate continuously. When the user prefers reduced motion, all HUD transitions and animations SHALL be disabled, and state changes SHALL appear immediately.

#### Scenario: Gaining a card
- **WHEN** the viewer receives one grain from production
- **THEN** the grain card enters the hand with a slide lasting at most 200 ms

#### Scenario: Reduced motion
- **WHEN** the user's system prefers reduced motion and the viewer gains a card or opens a dialog
- **THEN** the card and dialog appear without any transition
