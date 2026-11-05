## ADDED Requirements

### Requirement: Settings entry point
The client SHALL show exactly one Settings button (gear icon, accessible name "Settings") on the start screen, in the lobby and during a game, in the place the corner controls used today. It SHALL open the settings dialog. The HUD SHALL NOT show separate language, sound, notification or credits controls outside the dialog.

#### Scenario: One control on the board
- **WHEN** a player is in a game
- **THEN** the HUD corner shows the Settings button and no language switch, sound toggle, bell or credits button

#### Scenario: Open from the start screen
- **WHEN** a player on the start screen presses Settings
- **THEN** the settings dialog opens on its first section

### Requirement: Settings dialog layout
The settings dialog SHALL follow the shadcn `sidebar-13` layout: a modal dialog with a section sidebar on the left and the selected section's content on the right under a breadcrumb "Settings › <section>". The sections SHALL be, in order: Language, Sound, Notifications, Accessibility, About. On viewports narrower than the `md` breakpoint the sidebar SHALL be replaced by a section picker at the top of the dialog, and the dialog SHALL fit the screen without horizontal scrolling. The dialog SHALL have an accessible title "Settings", trap focus while open, close with Escape, the close button or a click outside, and return focus to the Settings button. The last selected section SHALL be remembered for the page session. Changing a setting SHALL apply immediately; there is no Save button. Opening the dialog SHALL NOT pause or block the game; game updates continue underneath.

#### Scenario: Navigate sections on desktop
- **WHEN** a player selects "Sound" in the sidebar
- **THEN** the sidebar marks Sound as active, the breadcrumb reads "Settings › Sound" and the sound settings are shown

#### Scenario: Phone
- **WHEN** the dialog is opened on a 375 px wide screen
- **THEN** no sidebar is shown, a section picker lists the five sections, and the content fits the width

#### Scenario: Keyboard
- **WHEN** the dialog is open and the player presses Escape
- **THEN** the dialog closes and keyboard focus is back on the Settings button

### Requirement: Language section
The Language section SHALL offer the supported languages as a single-choice group, each named in its own language, with the active one selected. Choosing one SHALL behave as "Manual language choice" in client-i18n, including the dialog's own text switching at once.

#### Scenario: Switch language in settings
- **WHEN** a player chooses Español in the Language section
- **THEN** the dialog, breadcrumb and HUD switch to Spanish while the dialog stays open on the same section

### Requirement: Sound section
The Sound section SHALL offer a "Game sounds" switch (the existing sound preference) and a volume slider from 0 to 100 % in steps of 5, default 60 %. The volume SHALL set the master gain of all game sounds. The slider SHALL be disabled while sounds are off. A "Test sound" button SHALL play the turn chime at the current volume (this also unlocks audio). Volume SHALL be stored with the other preferences and restored on load.

#### Scenario: Lower the volume
- **WHEN** a player sets the volume to 20 % and then a die is rolled
- **THEN** the dice sound plays at 20 % master gain

#### Scenario: Volume remembered
- **WHEN** a player sets 35 % and reloads the page
- **THEN** the slider shows 35 %

### Requirement: Notifications section
The Notifications section SHALL offer a "Turn notifications" switch with the same behavior as the notification opt-in in turn-notifications (permission requested only from this switch). It SHALL show the current state in words: on with push (alerts even with the tab closed), on in this tab only (push unavailable), off, blocked by the browser (with how to allow it in site settings), or not supported (switch hidden). On iOS without an installed app it SHALL explain that adding the game to the home screen enables notifications.

#### Scenario: Blocked
- **WHEN** notification permission is denied and the player opens the Notifications section
- **THEN** the switch is disabled and the text explains notifications are blocked and how to allow them

#### Scenario: Tab-only alerts
- **WHEN** notifications are on but the server sends no push key
- **THEN** the section says alerts only work while the game tab is open

### Requirement: Motion preference
The Accessibility section SHALL offer a motion choice: "Follow system" (default), "Reduce motion" and "Full motion". The client SHALL treat motion as reduced when the choice is "Reduce motion", or when it is "Follow system" and the browser reports `prefers-reduced-motion: reduce`. Everything that today honors the browser setting SHALL honor this choice instead: the dice throw, card count animations, board camera and piece motion, and CSS transitions and animations using the `motion-reduce` variant. The choice SHALL be stored with the other preferences and SHALL apply immediately.

#### Scenario: Reduce motion on a device without the OS setting
- **WHEN** the browser does not prefer reduced motion and the player chooses "Reduce motion"
- **THEN** the next roll shows the dice result without the throw animation

#### Scenario: Full motion overrides the OS
- **WHEN** the browser prefers reduced motion and the player chooses "Full motion"
- **THEN** the dice throw animation plays on the next roll

### Requirement: About section
The About section SHALL show the app name and client version, the active theme's asset credits (title, author, license and source link for each credit, or the theme's license/source declaration when it has no credits), and the project's license note. It SHALL replace the separate credits dialog.

#### Scenario: Credits moved
- **WHEN** a player opens About
- **THEN** every credit of the active theme is listed with a working source link

### Requirement: Preferences storage
Volume and motion SHALL be stored in the existing per-browser preferences record together with sound and notifications. Missing or invalid stored values SHALL fall back to their defaults (volume 60 %, motion "Follow system"). If storage cannot be read or written, every setting SHALL still work for the current page session.

#### Scenario: Old preferences record
- **WHEN** the stored record only has `sound` and `notify`
- **THEN** volume reads as 60 % and motion as "Follow system", and the stored sound and notify values are kept
