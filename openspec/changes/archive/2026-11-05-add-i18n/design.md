## Context

All client text is English literals, spread over three kinds of code:

- **React components** in `apps/client/src/hud/*` (labels, buttons, `aria-label`s, the `STYLE_LABEL` map in `Hud.tsx`, "No events yet." in `Feed.tsx`, …).
- **Pure text modules** that are unit-tested without React: `game/describe.ts` (log lines and toasts per engine event, plus `DEV_CARD_LABEL`), `game/status.ts` (turn status), `game/cards.ts` (`RESOURCE_LABEL`, `formatBundle`, `formatList`), `hud/errors.ts` (room and rule error text), `scene/labels.ts` (harbor marker text drawn onto a canvas texture).
- **Fallback names** such as `Seat N` in `hud/names.ts`.

Useful facts already in place: the feed store keeps raw `GameEvent`s and calls `describe()` at render time, so the log can be re-rendered in any language. The board-style setting (`theme/style.ts`) already shows the pattern for a device-saved preference with safe `localStorage` access and a pure "resolve initial value" function. Client tests run under Vitest with happy-dom and assert English text.

See proposal.md for motivation and `specs/client-i18n/spec.md` for the requirements.

## Goals / Non-Goals

**Goals:**
- One translation mechanism used by both components and pure modules.
- Compile-time key safety, plus a runtime parity test between catalogs.
- No visible flash of English before the detected language appears.
- Existing tests keep passing with minimal edits (they run in English).

**Non-Goals:**
- Right-to-left layouts (neither shipped language needs them).
- Lazy-loaded or remotely fetched catalogs.
- Translating server logs or server-side messages; the protocol stays language-neutral (codes only).
- Locale-specific number formatting beyond plurals and lists (game numbers are small integers).

## Decisions

### 1. i18next + react-i18next
Use `i18next` as the core and `react-i18next` for `useTranslation()`, so components re-render on a language change.
- *Why*: mature, small enough, built-in `fallbackLng`, interpolation, and plurals backed by `Intl.PluralRules` (`_one` / `_other` suffixes). Works outside React, which the pure modules need.
- *Alternatives*: `react-intl` (FormatJS) uses ICU message syntax and stronger formatting, but its core is tied to React context, which makes the pure modules awkward. A hand-rolled `t()` would need plurals, interpolation and fallback written and tested from scratch. Lingui needs a compile step through the Vite+ toolchain.

### 2. Catalogs as typed TypeScript modules, bundled
`src/i18n/locales/en.ts` is the source of truth (a nested object, `as const`). `es.ts` is typed `Catalog` (the same shape as `en`, with every leaf `string`), so a missing or extra key is a type error. Both are imported statically and passed as `resources` to `i18next.init` with `initImmediate: false`, so the language is ready before the first render (no Suspense, no flash). i18next's `CustomTypeOptions` points at `en`, which makes `t("hud.build.road")` key-checked.
- *Alternatives*: JSON files loaded over HTTP would add async init and a loading state for about 10 KB of text. JSON imported statically loses the `es` shape check.
- Key namespaces follow code areas: `common`, `resource`, `devCard`, `status`, `log`, `toast`, `error.room`, `error.rule`, `hud.<component>`, `board`, `language`.

### 3. Pure modules take `t` as a parameter
`describe(event, names, t)`, `statusOf(view, names, t)`, `formatBundle(b, t)`, `roomErrorText(code, fallback, t)` and similar take an i18next `TFunction`. Components get `t` from `useTranslation()` and pass it in. The fixed label maps (`RESOURCE_LABEL`, `DEV_CARD_LABEL`, `ROOM_ERROR_TEXT`, `RULE_ERROR_TEXT`, `STYLE_LABEL`) become key maps (`Record<Resource, Key>`) or small functions over `t`.
- *Why*: keeps the modules pure and deterministic. Tests pass a fixed-language `t` (`i18n.getFixedT("en")` or `"es"`) without global state.
- *Alternative*: importing the global `i18n` instance inside the modules is simpler at call sites, but it hides a dependency and makes the modules depend on language state, which is order-sensitive in tests.

### 4. Our own detection instead of `i18next-browser-languagedetector`
A pure `resolveInitialLanguage({ stored, preferences })` in `src/i18n/language.ts` mirrors `resolveInitialStyle`: a valid stored code wins; otherwise the first preference whose lowercase base tag is supported; otherwise `en`. Storage access reuses the try/catch pattern from `theme/style.ts` under the key `hexfall.language`. A small `setLanguage(code)` function calls `i18n.changeLanguage`, writes storage (errors are ignored) and updates `document.documentElement.lang`.
- *Why*: the detector package also reads cookies, the query string and `htmlTag`, and its matching rules are configurable but not obvious. The spec wants exactly "saved choice, then first supported base tag, then English". Twenty lines, fully testable.

### 5. `<html lang>`
Set it once after init and again in an `i18n.on("languageChanged")` handler, so every path that changes the language updates it. `index.html` keeps `lang="en"` as the static default.

### 6. Plurals and lists
Count-bearing strings use i18next plural keys (`log.received_one`, `log.received_other`). Card bundles ("2 Brick, 1 Ore") come from translated resource names with counts, joined with `Intl.ListFormat(lng, { type: "conjunction" })`. This replaces the English-only `plural()` and `formatList` helpers.

### 7. Harbor labels on the canvas
`harborLabel(type, t)` returns the translated resource name. The harbor marker component builds its canvas texture with a memo keyed on the label text, so a language change re-draws the texture. The rate text ("3:1") is not translated.

### 8. Language switch UI
A `LanguageSwitch` component, built like `BoardStyleSwitch` (same shadcn Button group, or a compact select if more languages are added later), shows each language's native name (`language.name` in its own catalog, never translated). It sits next to the board-style switch in the HUD and on the start screen. Its accessible name is translated ("Language" / "Idioma").

### 9. Tests
- A Vitest setup file (`test/setup.ts`, registered in `vite.config.ts` → `test.setupFiles`) initializes i18n in `en`, so current English assertions keep working.
- New tests cover `resolveInitialLanguage` (spec scenarios), storage failure, `<html lang>` updates, switching during a rendered HUD, catalog parity (a recursive key diff of `en` vs. each catalog, which reports missing and extra keys by path), runtime fallback to English, and `describe`/`statusOf` in Spanish for a sample of events, including plurals.

## Risks / Trade-offs

- [Large mechanical diff across every HUD file; strings get missed] → Add a test that renders the main HUD screens in Spanish and fails on known English-only words. Also review by grepping for JSX text nodes and `aria-label="…"` literals after the extraction.
- [Spanish strings are longer and may break the tight 360 px layout] → Check the narrow-phone and short-landscape layouts (hud-presentation scenarios) in Spanish. Use `truncate`/wrap where needed.
- [Pure-module signatures change (`t` parameter), which touches many tests] → Do it module by module. A test helper `tEn = i18n.getFixedT("en")` keeps the edits mechanical.
- [Translation quality] → Spanish is written by hand with standard board-game terms (Ladrillo, Grano, Madera, Mineral, Lana; Caballero, Construcción de carreteras, Año de abundancia, Monopolio, Punto de victoria). Get a native-speaker review before release.
- [Bundle size] → about 15 KB min+gz for i18next + react-i18next, plus a few KB per catalog. This is acceptable next to three.js.

## Migration Plan

Client only. No data migration. Without a saved choice, a browser preferring Spanish switches to Spanish on its first load after deploy; everyone else sees English as before. Rollback is a plain revert. The saved `hexfall.language` key is harmless if left behind.

## Open Questions

- Which further languages to add later (each one is a new catalog file plus an entry in the supported list; no design change).
