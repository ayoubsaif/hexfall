## Purpose

Define how the web client chooses the language it displays, from the browser's preferences or the player's own choice, and guarantee that every piece of user-facing text is translated in each supported language, with English as the safe fallback.

## ADDED Requirements

### Requirement: Supported languages

The client SHALL support English (`en`) and Spanish (`es`). English SHALL be the default language and the fallback language. Each supported language SHALL have a native-language display name (for example "English", "Español") used in the language switch.

#### Scenario: Supported list
- **WHEN** the language switch is opened
- **THEN** it lists exactly English and Español, each in its own language

### Requirement: Language from the browser

When no saved choice exists, the client SHALL pick its language from the browser's ordered language preferences (`navigator.languages`, or `navigator.language` when the list is unavailable). It SHALL take the first preference whose base language (the part before the first `-`, compared case-insensitively) is supported. If no preference matches, or the browser reports none, the client SHALL use English.

#### Scenario: Exact match
- **WHEN** the browser preferences are `["es"]` and nothing is saved
- **THEN** the client shows Spanish

#### Scenario: Regional variant
- **WHEN** the browser preferences are `["es-MX", "en-US"]` and nothing is saved
- **THEN** the client shows Spanish

#### Scenario: First supported preference wins
- **WHEN** the browser preferences are `["fr-FR", "en-GB", "es-ES"]` and nothing is saved
- **THEN** the client shows English

#### Scenario: Nothing supported
- **WHEN** the browser preferences are `["de-DE", "ja"]` and nothing is saved
- **THEN** the client shows English

### Requirement: Manual language choice

The client SHALL offer a language switch on the start screen and in the game HUD. Choosing a language SHALL switch all visible text immediately, without reloading the page or leaving the room or game. The choice SHALL be saved on the device and SHALL take precedence over the browser preferences on later visits. A saved value that is not a supported language SHALL be ignored. If the device storage cannot be read or written, the client SHALL still work, using the browser preferences and keeping the choice for the current page session only.

#### Scenario: Switch during a game
- **WHEN** a player in a game with Spanish shown chooses English
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
- **THEN** the client shows the browser-derived language and the switch still changes the language for the current page

### Requirement: Document language

The page's root element `lang` attribute SHALL always equal the code of the language being shown, and SHALL update when the language changes.

#### Scenario: Lang attribute follows the switch
- **WHEN** the client starts in Spanish and the player switches to English
- **THEN** the root `lang` attribute is `es` at start and `en` after the switch

### Requirement: All user-facing text is translated

Every piece of text the client shows or announces SHALL come from the active language's translations. This SHALL include labels and buttons, turn status lines, event log lines and toasts, resource and development card names, dialog text, room and rule error messages, tooltips, and accessible names (such as `aria-label`s) of controls. Player names, room codes, numbers, and artist or asset credits (names, titles, licences) SHALL be shown as they are. Free-text messages received from the server for unknown error codes MAY be shown untranslated as a last resort.

#### Scenario: Spanish HUD
- **WHEN** the client is in Spanish and it is the viewer's turn after rolling
- **THEN** the turn status, build controls and hand show Spanish text, and the resource cards are named in Spanish for screen readers

#### Scenario: Known error code
- **WHEN** the client is in Spanish and the server rejects a move with `not_your_turn`
- **THEN** the error shown is the Spanish text for that code

#### Scenario: Player names untouched
- **WHEN** a player named "Ana" builds a road and the client is in English
- **THEN** the log line contains "Ana" unchanged

### Requirement: Event log in the viewer's language

Event log lines and toasts SHALL be produced on the client from game events in the viewer's active language, so that players in the same game can each read the log in their own language. Switching language SHALL re-render existing log lines in the new language. Counts in text SHALL use the grammatical plural rules of the active language.

#### Scenario: Two players, two languages
- **WHEN** one player's client is in English and another's is in Spanish, and a player rolls the dice
- **THEN** each client shows the roll log line in its own language

#### Scenario: Existing lines re-rendered
- **WHEN** the log contains ten lines in English and the player switches to Spanish
- **THEN** all ten lines are shown in Spanish

#### Scenario: Plurals
- **WHEN** a log line reports receiving 1 card and another reports receiving 3 cards
- **THEN** each line uses the correct singular or plural form in the active language

### Requirement: Complete catalogs with English fallback

Every supported language SHALL provide a translation for every text key that English provides, and no language SHALL define keys that English lacks; this SHALL be checked by an automated test. At runtime, if a translation is missing in the active language, the client SHALL show the English text, and SHALL NOT show a raw key or an empty string.

#### Scenario: Catalog parity test
- **WHEN** the client test suite runs and the Spanish catalog lacks a key present in English
- **THEN** the test fails and names the missing key

#### Scenario: Runtime fallback
- **WHEN** a Spanish translation is missing at runtime
- **THEN** the English text is shown in its place
