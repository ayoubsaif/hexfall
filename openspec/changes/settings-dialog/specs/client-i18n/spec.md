## MODIFIED Requirements

### Requirement: Manual language choice

The client SHALL offer a language choice in the settings dialog (client-settings "Language section"), which is reachable from the start screen, the lobby and the game HUD. Choosing a language SHALL switch all visible text immediately, without reloading the page or leaving the room or game. The choice SHALL be saved on the device and SHALL take precedence over the browser preferences on later visits. A saved value that is not a supported language SHALL be ignored. If the device storage cannot be read or written, the client SHALL still work, using the browser preferences and keeping the choice for the current page session only.

#### Scenario: Switch during a game
- **WHEN** a player in a game with Spanish shown opens Settings and chooses English
- **THEN** the HUD, turn status, event log and open dialogs are shown in English
- **AND** the player stays seated in the same game

#### Scenario: Choice remembered
- **WHEN** a player whose browser prefers Spanish chooses English and later reloads the page
- **THEN** the client shows English

#### Scenario: Invalid saved value
- **WHEN** the saved language is `"xx"` and the browser prefers Spanish
- **THEN** the client shows Spanish

#### Scenario: Storage blocked
- **WHEN** reading or writing device storage throws
- **THEN** the client shows the browser-derived language and the choice still changes the language for the current page
