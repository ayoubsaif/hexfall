## Why

The game is mouse/touch only. Active players click the same few round buttons (roll, build, buy, trade, end turn) every turn, which is slow on desktop. Keyboard shortcuts speed up play, and players need a place to discover them.

## What Changes

- Add global keyboard shortcuts for the most used actions: roll dice, build road / settlement / city, buy development card, trade with bank, trade with players, end turn, play Knight, zoom in/out, cycle view preset.
- Shortcuts run only when the matching button is enabled (same legality as the click), never while typing in an input or while a modal dialog other than the shortcuts help is open.
- Show each shortcut as a key hint in the button tooltip and accessible description.
- Add a **Keyboard** section to the Settings dialog listing every shortcut, grouped (Turn, Build, Cards, Board view, General).
- `?` opens Settings on the Keyboard section from anywhere in the game.
- No rebinding in this change (fixed defaults).

## Capabilities

### New Capabilities
- `keyboard-shortcuts`: shortcut registry, key handling rules (guards, modifiers, input focus), button hints, and the shortcuts list in Settings.

### Modified Capabilities
- `view-controls-input-theme`: view controls expose zoom and view-preset shortcuts and show them in `title` text.

## Impact

- Client only (`apps/client`): new `hotkeys/` module (registry + `useHotkeys`), `ActionButtons.tsx`, `Fab.tsx` (key hint), `DiceTray.tsx`, `DevCards.tsx`, `ViewControls.tsx`, `settings/` (new section, `sections.ts`, `SettingsDialog.tsx`), i18n `en`/`es` `settings.ts` and `play.ts`.
- No engine, server, or protocol change. No new dependency.
