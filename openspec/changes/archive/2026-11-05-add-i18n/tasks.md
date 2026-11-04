## 1. Foundation

- [x] 1.1 Add `i18next` and `react-i18next` to the pnpm catalog and `apps/client/package.json` (and to `optimizeDeps.include`); verify `pnpm install` succeeds and `vp build` still builds
- [x] 1.2 Create `src/i18n/language.ts`: `SUPPORTED_LANGUAGES`, `isLanguage`, pure `resolveInitialLanguage({ stored, preferences })`, safe storage read/write under `hexfall.language` (same try/catch pattern as `theme/style.ts`); verify unit tests cover every "Language from the browser" and "Invalid saved value" scenario, plus storage that throws
- [x] 1.3 Create `src/i18n/locales/en.ts` (source of truth, `as const`) and the `Catalog` type, with the namespaces from design decision 2; verify it type-checks
- [x] 1.4 Create `src/i18n/index.ts`: synchronous `i18next.init` (bundled resources, `fallbackLng: "en"`, `initImmediate: false`), `CustomTypeOptions` augmentation, `setLanguage(code)` (change language, save, update `document.documentElement.lang`) and a `languageChanged` handler that keeps `<html lang>` in sync; verify with a test that `<html lang>` follows `setLanguage`
- [x] 1.5 Initialize i18n in `main.tsx` before the first render, with the language from `resolveInitialLanguage`; add `test/setup.ts` (init in `en`) and register it in `vite.config.ts` `test.setupFiles`; verify the existing client test suite still passes unchanged

## 2. Pure text modules

- [x] 2.1 `game/cards.ts`: replace `RESOURCE_LABEL` with translated names; `formatBundle(b, t)` and `formatList(items, lng)` via `Intl.ListFormat`; update callers and `cards.test.ts`; verify tests pass in `en` and a new `es` case
- [x] 2.2 `game/describe.ts`: take `t` for every event describer and toast, use plural keys instead of `plural()`, and turn `DEV_CARD_LABEL` into keys; move all strings to `en.ts`; verify `describe.test.ts` passes in English and new Spanish cases cover a roll, a steal, production with 1 vs 3 cards, and a dev-card purchase
- [x] 2.3 `game/status.ts`: take `t` and move every status line to the catalog; verify `status.test.ts` passes, plus Spanish cases for setup, rolling and discard, and `describe-timeout.test.ts` keeps passing
- [x] 2.4 `hud/errors.ts`: turn room and rule error maps into keys under `error.room` / `error.rule`; `roomErrorText` / `ruleErrorText` take `t` and keep the server fallback for unknown codes; verify a test that `not_your_turn` in Spanish gives the Spanish text and an unknown code gives the fallback
- [x] 2.5 `hud/names.ts` "Seat N" fallback, `hud/countdown.ts` text, and `scene/labels.ts` `harborLabel(type, t)`; make the harbor marker texture re-draw when its label text changes; verify `labels.test.ts` with a Spanish case

## 3. HUD components

- [x] 3.1 Extract text and `aria-label`s from `StartScreen`, `Lobby`, `ReplacedNotice` and `Credits` (credit names and licences stay as-is) using `useTranslation`; verify `session-ui`, `Lobby-timer` and `Credits` tests pass
- [x] 3.2 Extract text from `PlayerPanels`, `StatusPill`, `TurnFocus`, `actions/*` (ActionButtons, Fab, CountdownText), `dice/*`, `Hand`, `DevCards` and `cards/GameCard` (including card accessible names); pass `t` into `statusOf`/`formatBundle`; verify `game-ui-panels`, `game-ui-cards`, `floating-hud`, `TurnFocus` and `DiceTray` tests pass
- [x] 3.3 Extract text from `Dialogs`, `MaritimePanel`, `Feed` (empty-log text, log lines, toasts) and `Hud` (`STYLE_LABEL`, toggles); verify `game-ui-dialogs` and `Hud` tests pass
- [x] 3.4 Grep `apps/client/src` for remaining English JSX text nodes, `aria-label="…"`, `title="…"` and `placeholder="…"` literals, and translate what is left; verify the grep shows only intentional exceptions (player names, numbers, rates, credits)

## 4. Spanish and the language switch

- [x] 4.1 Write `src/i18n/locales/es.ts` typed as `Catalog`, with standard board-game terms (design: Risks); verify it type-checks, so no key is missing or extra
- [x] 4.2 Add a catalog parity test (recursive key diff of `en` vs. every catalog, which reports missing and extra key paths) and a runtime-fallback test (a key removed from `es` at runtime renders English, never the raw key); verify both pass and the parity test fails when a key is deleted from `es`
- [x] 4.3 Build `LanguageSwitch` (native names, translated accessible name) and place it on the start screen and next to `BoardStyleSwitch` in the HUD; verify a test that switching to English during a rendered game re-renders the status, the existing log lines and an open dialog without dropping the session

## 5. Verification

- [x] 5.1 Add an integration-style test that renders the in-game HUD in Spanish and fails on a list of English-only words (e.g. "Roll", "Build", "Trade", "Brick", "turn"); verify it passes
- [x] 5.2 Run the full workspace test suite and type-check (`pnpm -r test`, `tsc`); verify both are clean
- [ ] 5.3 Manually run the client with the browser set to `es-ES`, then `en-US`, then `fr-FR`, check the detected language each time, switch the language mid-game, reload to confirm the choice is kept, and check the 360 px and 900 × 500 layouts in Spanish for overflow
