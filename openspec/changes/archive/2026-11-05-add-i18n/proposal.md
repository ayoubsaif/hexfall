## Why

Every word the client shows is hard-coded English: HUD labels, turn status, the event log, toasts, error messages, dialogs and accessible names. Players who don't read English can't follow the game. The client should speak the player's language, picked from the browser, without an account or setup step.

## What Changes

- Add an internationalization layer to `apps/client` (i18next + react-i18next, using the browser's `Intl` APIs for plurals and lists).
- **Language detection**: on load, the client picks the first supported language from `navigator.languages` (matching on the base tag, so `es-MX` → `es`). If none match, it uses English.
- **Manual override**: a small language switch on the start screen and in the HUD, next to the board-style switch. The choice is saved in `localStorage` and beats the browser language on the next visit. Storage errors are ignored, as with the board style.
- **Shipped languages**: English (`en`, default and fallback) and Spanish (`es`). Adding a language means adding one catalog file. *Assumption: Spanish is the first extra language; change the list here if you want others.*
- **Extract all user-facing text** into translation catalogs:
  - start screen, lobby, player panels, turn bar, build bar, hand, development cards, dialogs, maritime panel, feed/log, toasts, credits, replaced-seat notice;
  - turn status lines (`game/status.ts`) and event log lines (`game/describe.ts`), with correct plurals;
  - resource and development card names (`RESOURCE_LABEL`, `DEV_CARD_LABEL`);
  - room and rule error texts (`hud/errors.ts`);
  - `aria-label`s and other accessible names;
  - harbor marker labels on the board, if they contain words.
- Set `<html lang>` to the active language and update it when the language changes.
- A missing key in a non-English catalog falls back to English, never to a raw key. A test checks that every catalog has the same keys as English.
- Not translated: player names, room codes, artist and asset credits (proper names), and server-sent free-text fallbacks (the client already maps known error codes to its own text).
- Game rules, engine, protocol and server are untouched. The event log is still built from engine events on the client, so each player sees the log in their own language.

## Capabilities

### New Capabilities
- `client-i18n`: how the client chooses its display language (browser detection, supported-language matching, English fallback, persisted manual override, `<html lang>`), and the rule that every user-facing string, including log lines, status, errors and accessible names, comes from a translation catalog with complete coverage in each shipped language.

### Modified Capabilities
<!-- none: openspec/specs has no client capability yet (game-hud and hud-presentation live in open changes). Their behavior is unchanged; only the text source changes. -->

## Impact

- **Code**: `apps/client/src/hud/*`, `apps/client/src/game/{describe,status,cards}.ts`, `apps/client/src/hud/errors.ts`, `apps/client/src/main.tsx` / `App.tsx` (init), `apps/client/src/scene` label code (harbors), new `apps/client/src/i18n/` (setup, detection, catalogs).
- **Tests**: client tests that assert English text keep working by running under `en`; new tests for detection, override, fallback and catalog parity.
- **Dependencies**: `i18next`, `react-i18next` added to the client (via the pnpm catalog).
- **No changes** to `packages/engine`, `packages/protocol` or `apps/server`.
