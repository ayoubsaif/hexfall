## ADDED Requirements

### Requirement: Synthesized sounds
The client SHALL generate every game sound at runtime with the Web Audio API and SHALL NOT load audio files. It SHALL provide two sounds:
- a **turn chime**: a short, pleasant two-note cue, under 1 s;
- a **dice rattle**: a burst of short percussive clicks, about as long as the dice throw animation.

All sounds SHALL share one `AudioContext`, created lazily. When the browser does not support Web Audio, sound calls SHALL do nothing and SHALL NOT throw.

#### Scenario: No Web Audio
- **WHEN** `AudioContext` is undefined and a roll arrives
- **THEN** no sound plays, no error is thrown and the dice still animate

### Requirement: Audio unlock
Browsers block audio until the user interacts with the page. The client SHALL resume its `AudioContext` on the first pointer or key interaction with the page, and SHALL retry on later interactions while it is still suspended. A sound requested while audio is still locked SHALL be dropped, not queued.

#### Scenario: Turn starts before any click
- **WHEN** the viewer resumes into a game and their turn starts before they have clicked anything
- **THEN** no chime plays and nothing plays later when they first click

#### Scenario: After first interaction
- **WHEN** the viewer has clicked once on the page and their turn starts
- **THEN** the turn chime plays

### Requirement: Turn chime
The client SHALL play the turn chime once each time a wait on the viewer begins: when the viewer's legal moves first include `rollDice` or `rollForOrder`, a setup placement, or a discard after being without them. It SHALL NOT play on the first view after joining or resuming, SHALL NOT play again while the same wait continues, and SHALL NOT play once the game has ended.

#### Scenario: Turn passes to the viewer
- **WHEN** the previous player ends their turn and the viewer may now roll
- **THEN** the turn chime plays once

#### Scenario: Viewer owes a discard
- **WHEN** another player rolls a 7 and the viewer holds 9 cards
- **THEN** the turn chime plays once when the discard is requested

#### Scenario: Resume during own turn
- **WHEN** the viewer reloads the page during their own roll wait
- **THEN** no chime plays on the snapshot

### Requirement: Dice sound
The client SHALL play the dice rattle when a new roll (dice roll or roll for order, by any seat, including a roll made by the turn timer) arrives in a live game update. It SHALL NOT play for rolls contained in a snapshot (start, join, resume), and SHALL play at most once per roll. It SHALL play even when the user prefers reduced motion and the dice do not animate.

#### Scenario: Opponent rolls
- **WHEN** another seat rolls and the update arrives
- **THEN** the dice rattle plays once

#### Scenario: Snapshot on join
- **WHEN** the viewer joins a game whose log already holds rolls
- **THEN** no dice rattle plays

### Requirement: Mute setting
The HUD SHALL offer a sound toggle next to the language switch, with an accessible label that states the current state ("Mute sounds" / "Unmute sounds"). Sound SHALL be on by default. The choice SHALL be stored in `localStorage` and restored on load; when storage is unavailable the toggle SHALL still work for the session. While muted, no game sound SHALL play.

#### Scenario: Mute persists
- **WHEN** the viewer mutes sounds and reloads the page
- **THEN** the toggle shows muted and no sound plays on the next roll

#### Scenario: Storage blocked
- **WHEN** `localStorage` throws on access and the viewer mutes
- **THEN** sounds stop for this page session and no error is shown
