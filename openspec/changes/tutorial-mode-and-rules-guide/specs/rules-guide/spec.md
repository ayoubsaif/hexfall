## Purpose

Give players an illustrated, always-available summary of the base game rules, opened from an info button on the start screen and during a game.

## ADDED Requirements

### Requirement: Info button
An info button with an accessible name ("How to play") SHALL be shown next to the Settings button on every screen, including the start screen and during a game, whether or not tutorial mode is on. Pressing it SHALL open the rules guide. Opening the guide during a game SHALL NOT pause the game or change any game state.

#### Scenario: In game
- **WHEN** the player presses the info button during a game
- **THEN** the rules guide opens over the board and the game keeps running

#### Scenario: Start screen
- **WHEN** the player presses the info button on the start screen
- **THEN** the rules guide opens

### Requirement: Rules guide content
The rules guide SHALL present the base game rules in these sections, in order: Goal and components, Setup, Turn order, Production, Building and costs, The robber and rolling a 7, Development cards, Trading, Longest Road and Largest Army, Winning. Its text SHALL match the base rules the engine implements (no house rules) and SHALL be available in every client language. Each section SHALL show one illustration with alternative text, kept small (a thumbnail beside the intro on wider screens, a short banner on phones) so the text leads, and a strip of the real game pieces the section explains (resource and development cards, piece icons, costs as cards, dice, trade rates, number tokens with their odds, victory points) with short captions. The guide SHALL let the player move between sections (a section list plus previous/next), SHALL open at a requested section when opened from a tutorial link, and SHALL close on Escape, the close button, or a tap outside.

#### Scenario: Section order
- **WHEN** the rules guide opens with no requested section
- **THEN** it shows "Goal and components" first, with previous disabled

#### Scenario: Open at section
- **WHEN** the guide is opened from the robber phase hint
- **THEN** it shows the "The robber and rolling a 7" section

#### Scenario: Building costs as cards
- **WHEN** the player reads the building section
- **THEN** each of road, settlement, city and development card is shown with its cost as resource cards and its victory points

#### Scenario: Robber text
- **WHEN** the player reads the robber section
- **THEN** it says players with more than 7 cards discard half rounded down, the robber must move to a different hex, and one random card is stolen from an adjacent opponent

### Requirement: Illustrations are pre-generated assets
Each section illustration SHALL be a static WebP image served from the app's own origin, generated ahead of time with the Gemini image API in the same painted style as the development card art, and committed to the repository. The client SHALL NOT call any image-generation API and SHALL NOT need an API key. The guide SHALL stay usable with text only if an illustration fails to load.

#### Scenario: Offline-safe
- **WHEN** the rules guide is opened
- **THEN** no request leaves the app's origin

#### Scenario: Missing image
- **WHEN** an illustration fails to load
- **THEN** the section text is still shown and the layout does not break
