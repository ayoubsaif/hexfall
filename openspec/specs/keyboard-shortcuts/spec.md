# keyboard-shortcuts Specification

## Purpose

TBD - keyboard shortcuts for game actions and board view, driven by a single registry, with hints on buttons and a list in Settings.

## Requirements

### Requirement: Shortcut registry
The client SHALL define every shortcut in one registry giving each an action id, a default key, a group and an i18n label. The registry SHALL be the only source for key handling, button hints and the Settings list. Defaults: Space or `R` roll dice, `1` build road, `2` build settlement, `3` build city, `D` buy development card, `B` trade with bank, `T` trade with players, `E` or `Enter` end turn, `K` play Knight, `+` zoom in, `-` zoom out, `V` cycle view preset, `?` open the shortcuts list.

#### Scenario: Single source
- **WHEN** a default key is changed in the registry
- **THEN** key handling, tooltips and the Settings list all show the new key

### Requirement: Shortcut triggers the same action as the button
A shortcut SHALL run only when its button is enabled, using the same legality as a click. A disabled or hidden action SHALL do nothing and show no error. Build shortcuts SHALL toggle the build choice like the button.

#### Scenario: Build road while affordable
- **WHEN** the active player can build a road and presses `1`
- **THEN** road placement mode starts, as if the road button was clicked

#### Scenario: Not affordable
- **WHEN** the player cannot afford a city and presses `3`
- **THEN** nothing happens

#### Scenario: Not the viewer's turn
- **WHEN** another player is active and the viewer presses `E`
- **THEN** no turn ends

### Requirement: Key handling guards
Shortcuts SHALL be ignored while focus is in a text input, textarea, select or contenteditable, while Ctrl, Meta or Alt is held, and for auto-repeat events. Shortcuts that act on the game SHALL be ignored while a modal dialog is open; `?` SHALL work except while another modal is open. Keys SHALL match layout-independent characters (`event.key`, case-insensitive).

#### Scenario: Typing in chat field
- **WHEN** focus is in a text input and the user types `d`
- **THEN** no development card is bought

#### Scenario: Browser shortcut
- **WHEN** the user presses Ctrl+R
- **THEN** the page reloads normally and no dice are rolled

#### Scenario: Held key
- **WHEN** the user holds `E`
- **THEN** only one end-turn action is sent

### Requirement: Key hints on buttons
Each button with a shortcut SHALL show its key in its tooltip and in its accessible description. Touch-only devices MAY hide the visible hint.

#### Scenario: Tooltip
- **WHEN** the user hovers the End turn button
- **THEN** the tooltip shows the label and the key `E`

### Requirement: Shortcuts list in Settings
The Settings dialog SHALL have a **Keyboard** section, listed before About, showing every registry shortcut grouped by Turn, Build, Cards, Board view and General, with the key as a keycap and the localized label. Pressing `?` SHALL open Settings on this section. Labels SHALL be translated in English and Spanish.

#### Scenario: Open by key
- **WHEN** the user presses `?` during a game
- **THEN** Settings opens on the Keyboard section

#### Scenario: Open by menu
- **WHEN** the user opens Settings and selects Keyboard
- **THEN** all shortcuts are listed with their keys

#### Scenario: Language
- **WHEN** the language is Spanish
- **THEN** the shortcut labels are Spanish and the keys are unchanged
