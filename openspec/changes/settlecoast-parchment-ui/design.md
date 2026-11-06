## Context

Client is React 19 + Tailwind v4 (`@theme static` tokens in `apps/client/src/style.css`) with shadcn-style primitives in `components/ui`. Look today: `bg-hud` translucent dark panels, `system-ui`, orange accent, aurora blobs on `.app::before/::after`. HUD components mostly use token utilities (`bg-hud`, `text-hud-fg`, `text-muted-foreground`, `bg-white/10`), so retheming through tokens reaches most of the UI; hard-coded `white/..` and `black/..` utilities need a pass.

Reference style (captured with REA from settlecoast.com, plus the two supplied screenshots): cream paper `#e6d4b5` with ink `#304b43` and gold `#876235`; forest-green selected tiles; dark brown leather buttons with gold rivets; corner brackets on tiles; Cormorant Garamond headings, Manrope body; uppercase letter-spaced eyebrow labels; double hairline page border on the splash.

## Goals / Non-Goals

**Goals:**
- One token set that makes every HUD surface read as paper/wood while keeping WCAG AA contrast (4.5:1 text, 3:1 UI).
- Start screen, lobby, saved games and splash match the reference composition.
- Over the 3D board the HUD stays legible and small (board remains full-screen background).

**Non-Goals:**
- No new game features (AI opponents, online/friends lists, music, accounts, "free to play" badge).
- No copying of the reference site's images, logo, text or code; no 3D scene/art changes.
- No layout changes to the responsive HUD arrangement.
- No multi-theme switcher (dark/terracotta palettes are not built; tokens leave room for it).

## Decisions

1. **Tokens first.** Redefine `@theme` colours: `--color-paper`, `--color-paper-deep`, `--color-ink`, `--color-ink-muted`, `--color-forest`, `--color-leather`, `--color-gold`. Re-point existing names (`hud`, `hud-fg`, `hud-muted`, `background`, `foreground`, `primary`, `border`, `ring`) at them so untouched components follow. Alternative: rename everything to new utilities — rejected, large diff, high churn in tests.
2. **Fonts self-hosted** as variable WOFF2 in `public/fonts` (Cormorant Garamond, Manrope; latin + latin-ext), `font-display: swap`, preloaded in `index.html`. `--font-serif` for headings/titles/numbers-in-titles, `--font-sans` for body. Alternative: Google Fonts CDN — rejected (privacy, offline PWA via `sw.js`, CSP). The service worker has no fetch handler by design (turn notifications only), so fonts rely on normal HTTP caching, not offline precache.
3. **Paper surface without images.** Layered CSS: base colour, subtle SVG-noise `background-image` (inline data URI, tiny), inner 1px gold hairline via `box-shadow: inset`, soft drop shadow. Alternative: bitmap parchment texture — rejected (weight, tiling seams, licensing).
4. **Corner brackets** as a `Frame` utility (`.frame` class using four `background` gradients or pseudo-elements, colour `--color-leather`), applied to option tiles and dialogs. Pure CSS, no markup churn.
5. **Buttons.** `default` = leather plaque (dark brown gradient, gold inner border, cream serif label); `secondary` = paper tile with ink text and corner brackets; `selected` state (`aria-pressed`/`data-selected`) = forest-green fill with cream text; `ghost`/`link` ink-based. Min heights unchanged (40px on mobile).
6. **Surface variants by context.** Floating HUD pieces over the board (player panels, dice readout, turn pill) use paper at ~92% opacity with `backdrop-blur-sm`, so they stay readable over any hex. Full panels (start, lobby, dialogs, settings) use opaque paper. Alternative: fully opaque everywhere — rejected, hides too much board on small screens.
7. **Splash** (`hud/Splash.tsx`) is a React overlay mounted until the theme manifest and first models resolve (hook into existing `ThemeProvider` load state). Content: eyebrow "Gather · Trade · Build", title, tagline, progress bar bound to load progress (indeterminate if unknown), rotating tip (5 tips, i18n keys, 6 s, pause button, next button). Minimum visible time 0 (never delays a ready app). Illustration is a CSS/SVG hex cluster, not the reference artwork.
8. **Aurora removed**, replaced by `radial-gradient` vignette on `.app` in dark-brown/teal behind the canvas (visible only outside the island). Keeps the cost profile (no filters, no animation).
9. **Game semantics keep colour.** Resource frames (`res-*`) and player colours are unchanged but re-checked for contrast against paper labels; player panels get a coloured edge instead of a coloured fill where contrast would fail.
10. **i18n**: all new strings (splash tips, eyebrow, tagline, section headings) via `labels.ts` in every supported language; no hard-coded English.

## Risks / Trade-offs

- [Light panels over a dark ocean glare at night] → paper-deep shade + 92% opacity, `color-scheme` untouched; verify with screenshots at 360×740, 900×500, 1440×900.
- [Contrast regressions from hard-coded `white/..` utilities] → grep sweep of `text-white|bg-white|border-white|bg-black` in `src`, replace with tokens; add a contrast unit check for the token pairs.
- [Font payload (~150–250 KB)] → subset latin/latin-ext, variable files, preload only the two used weights' files, swap fallback metrics (`size-adjust`) to limit layout shift.
- [Existing tests assert dark classes/colours] → update with the change; keep test ids and roles stable.
- [Overlap with unarchived `hud-tailwind-cards` / `aurora-background`] → this change supersedes the dark look and aurora; note in archive step so main specs end up consistent.
- [Look-alike concern] → only palette/type/framing conventions are used; own illustrations, wording and ornaments.

## Migration Plan

Ship behind no flag (pure presentation). Land in order: tokens+fonts → primitives → start/lobby/saved → in-game HUD → splash → cleanup. Each step builds and passes tests. Rollback = revert the commits; no data or protocol changes.

## Open Questions

- Should a dark-parchment variant (reference's `#183d48` palette) follow the OS dark mode, or is one light theme enough for now? Default here: one theme.
- Keep the orange accent for turn/alert emphasis, or use gold? Default here: gold for emphasis, existing `ok/wait/bad` for status.

## Entry menu refinement (owner request, 2026-11-07)

The latest requested direction supersedes the earlier CSS-only paper and illustrated entry treatment: use the supplied small, locally served parchment photograph for the entry background and shared paper surfaces. Do not show a drawn island or a live 3D board before joining a room. Mount the board canvas on entering a room and release it when leaving.

The welcome menu uses three large leather buttons with existing painted gold HUD icons: host with friends, practice with bots, and join with a room code. Each opens a focused form with the existing validation and server actions. Invite links bypass the menu. A back action returns to mode selection; the optional rules guide remains collapsed initially. Bot play already exists and is exposed here without introducing a new game feature.
