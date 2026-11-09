## Purpose

Teach new players the base Catan rules while they play: rule helpers on game controls and a hint for what to do now, shown until the player turns tutorial mode off, with that choice kept in a cookie.

## ADDED Requirements

### Requirement: Tutorial on by default
Tutorial mode SHALL be on for a browser that has no tutorial cookie. It SHALL be off when the `hexfall_tutorial` cookie holds `off`, and on when it holds `on`. Any other cookie value SHALL be treated as no cookie.

#### Scenario: First visit
- **WHEN** a browser with no `hexfall_tutorial` cookie opens the app
- **THEN** tutorial mode is on

#### Scenario: Turned off earlier
- **WHEN** the browser has `hexfall_tutorial=off` and the app is reloaded
- **THEN** tutorial mode is off and no helpers or hints are shown

### Requirement: Turning tutorial off and on
The player SHALL be able to turn tutorial mode off from a "Turn off tutorial" control in the tutorial hint and from a switch in Settings, and back on from the same Settings switch. Each change SHALL take effect immediately without a reload and SHALL write the `hexfall_tutorial` cookie with value `on` or `off`, path `/`, `SameSite=Lax`, `Secure` when served over HTTPS, and a max-age of 365 days. The cookie SHALL NOT be sent to or read by the game server for any purpose. If cookies cannot be written, the choice SHALL last for the current page session.

#### Scenario: Dismiss from the hint
- **WHEN** tutorial mode is on and the player presses "Turn off tutorial" in the hint
- **THEN** the hint and all rule helpers disappear at once and the cookie `hexfall_tutorial=off` is set

#### Scenario: Re-enable from Settings
- **WHEN** tutorial mode is off and the player turns the Settings "Tutorial" switch on
- **THEN** helpers and hints show again and the cookie becomes `hexfall_tutorial=on`

#### Scenario: Cookies blocked
- **WHEN** writing the cookie fails and the player turns tutorial off
- **THEN** tutorial stays off until the page is reloaded and no error is shown

### Requirement: Rule helpers on game controls
While tutorial mode is on, each game action control SHALL offer a rule helper hover card: build road, build settlement, build city, buy development card, play development card (each type), roll dice, end turn, maritime trade, player trade, the robber placement and steal choice, and the discard dialog. A helper SHALL state what the action does, its cost where it has one, and the rules that limit it, matching the base rules (for example the Distance Rule for settlements, road connectivity blocked by opponents' buildings, one development card per turn and not on the turn it was bought, the 4:1 / 3:1 / 2:1 trade rates, discard half rounded down when holding more than 7). When the action is currently unavailable, the helper SHALL also say why in plain words (e.g. "You need 1 brick and 1 lumber", "No pieces left", "Roll the dice first"). While tutorial mode is off, these controls SHALL behave exactly as before, with only their existing tooltips.

#### Scenario: Settlement helper
- **WHEN** tutorial mode is on and the player hovers the build settlement button
- **THEN** a hover card shows the cost (1 brick, 1 lumber, 1 wool, 1 grain), that it must touch one of their roads, and the Distance Rule

#### Scenario: Unavailable action explained
- **WHEN** tutorial mode is on and the player cannot afford a city and hovers the city button
- **THEN** the helper lists the missing resources

#### Scenario: Tutorial off
- **WHEN** tutorial mode is off and the player hovers the build road button
- **THEN** only the existing tooltip is shown

### Requirement: Phase hint
While tutorial mode is on and a game is running, the HUD SHALL show one short hint describing what the viewer must or can do now, derived from the game state: setup placement (settlement then road, Distance Rule, second settlement grants starting resources), waiting for another player, roll the dice (and that a Knight may be played first), discard half when holding more than 7, move the robber to a different hex and choose a victim, the trade/build part of the turn, and free roads from Road Building. The hint SHALL update when the phase changes, SHALL NOT cover the board's central area or the viewer's action buttons, SHALL be collapsible to a small icon for the rest of the game, and SHALL include the "Turn off tutorial" control and a link that opens the rules guide at the matching section.

#### Scenario: Must roll
- **WHEN** it is the viewer's turn before the roll
- **THEN** the hint says to roll the dice and that a Knight may be played before rolling

#### Scenario: Robber after a 7
- **WHEN** the viewer rolled a 7 and must move the robber
- **THEN** the hint says to move the robber to a different hex and then steal from an adjacent opponent

#### Scenario: Link to rules
- **WHEN** the player presses "Learn more" in the hint during setup
- **THEN** the rules guide opens at the setup section

### Requirement: Tutorial text is localized
All tutorial helper and hint text SHALL be available in every client language (English and Spanish) and SHALL follow the selected language.

#### Scenario: Spanish
- **WHEN** the client language is Spanish and tutorial mode is on
- **THEN** helpers and hints are shown in Spanish
