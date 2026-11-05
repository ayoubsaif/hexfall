## Why

Client settings are scattered as separate floating controls in the HUD corner: the language switch, the sound toggle, the notifications bell and the credits button. Each new setting adds another pill over the board, crowding it on phones and giving no room for labels or explanations (for example why notifications are blocked). One settings dialog gives every setting a labeled home and leaves a single button on the board.

## What Changes

- Add the shadcn **sidebar-13** block ("settings dialog with a sidebar") via `npx shadcn@latest add sidebar-13`, plus the UI primitives it pulls in (`sidebar`, `breadcrumb`, `separator`, `input`, `skeleton`, `use-mobile`; `dialog`, `sheet`, `button`, `tooltip` already exist), adapted to the HUD theme tokens.
- Replace the corner controls with **one Settings button** (gear icon) on the start screen, in the lobby and in the game. It opens the settings dialog.
- The dialog has a section sidebar (desktop) or a section picker (phones) and these sections:
  - **Language**: English / Español (same behavior as today's switch).
  - **Sound**: game sounds on/off and a volume slider, with a "Test sound" button.
  - **Notifications**: turn notifications on/off, current browser permission (allowed / blocked / not supported) with help text, and whether push is active or only in-tab alerts work.
  - **Accessibility**: motion — follow system / reduce / full. Applies to the dice throw, card animations, the board camera motion and CSS transitions.
  - **About**: version, asset credits (moved from the credits dialog), license note.
- New persisted preferences: `volume` and `motion`, kept in the existing `hexfall.prefs` record.
- Remove `LanguageSwitch`, `SoundToggle`, `NotifyToggle` and `CreditsButton` from the HUD corner. **BREAKING** for the HUD layout only (no protocol or server change).

Non-goals: board style (being removed by `flat-board-3d-chips`), the lobby's turn-timer preset (a per-game host choice, stays in the lobby), account or server-side settings.

## Capabilities

### New Capabilities
- `client-settings`: the settings dialog (entry point, sections, navigation on desktop and phones, accessibility), the persisted preferences (volume, motion), and how each setting applies.

### Modified Capabilities
- `client-i18n`: "Manual language choice" moves the language switch from the start screen and HUD into the settings dialog, reachable from both.

## Impact

- **Client** (`apps/client`): new `src/components/ui/{sidebar,breadcrumb,separator,input,skeleton,slider}.tsx`, `src/hooks/use-mobile.ts`, `src/settings/` (dialog and sections), `store/prefs.ts` (volume, motion), `audio/engine.ts` (master gain from volume), `prefersReducedMotion()` reads the motion preference, a `motion-reduce` variant override in `style.css`, `Hud.tsx` corner, `Credits.tsx` folded into the About section, i18n keys (en/es), updated HUD tests.
- **Dependencies**: shadcn-generated files only; `radix-ui` slider/separator packages as the CLI adds them.
- **Server, protocol, engine**: no change.
- **Overlap**: builds on `turn-sound-and-push` (sound and notification prefs) and conflicts in `Hud.tsx` with in-flight `flat-board-3d-chips` and `player-trading` edits — apply after those land or merge carefully.
