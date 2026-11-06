## Why

The HUD is a dark, translucent glass look (`bg-hud`, system font) that feels generic next to the target style: a warm storybook "parchment and wood" board game (cream paper, forest green, brown leather buttons, ornate corner frames, serif headings). The two reference screens (a splash/loading screen and a start-menu card) show that look. Moving to it makes the game feel like a tabletop game, not a dashboard.

Style evidence was gathered with REA from a live capture of settlecoast.com (viewport screenshot, page inspection, served HTML and CSS): fonts are Cormorant Garamond (headings) and Manrope (body); three themed palettes exist (dark teal `#183d48`/ink `#f2e5c9`, parchment `#e6d4b5`/ink `#304b43`/gold `#876235`, terracotta `#994e2c`). Only **style language** is adopted (palette, type, framing, layout of menus). No artwork, logos, copy or code from that site is copied; ornaments are drawn with our own CSS/SVG.

## What Changes

- Add a parchment design-token set (paper, ink, forest green, leather brown, gold) and the two web fonts (Cormorant Garamond, Manrope), self-hosted, with system-serif/sans fallbacks.
- Restyle the shared UI primitives (`Button`, `Card`, `Dialog`, `Sheet`, `Input`, `Badge`, `Tabs`, `Switch`, `Slider`, `Tooltip`) to the new tokens: paper surfaces with torn-edge/inner-border, ornate corner brackets, leather "plaque" primary button, green selected-state tiles.
- Redesign the start screen (`StartScreen`) as a parchment menu card: title block, option tiles (Play with friends / game lobby, saved games, name field, primary "Create room" plaque). Behaviour and flows stay as they are; only structure/styling change. Controls that do not exist yet (AI opponents, online/friends counts, music toggle) are NOT added.
- Add a splash/loading screen: parchment page with double border, title, tagline, a progress bar and a rotating "field guide" tip while the theme/models load.
- Restyle the in-game HUD (player panels, hand, trade, dice tray, log, dev cards, pause, lobby, saved games) with the parchment surfaces and serif headings; resource card frames and player colours keep their game meaning and contrast.
- Replace the aurora ambient background with a paper/vignette treatment; board canvas stays full-screen behind the HUD.
- Keep reduced-motion, 40px touch targets, i18n and keyboard/focus behaviour.

## Capabilities

### New Capabilities
- `parchment-theme`: Design tokens, typography, surface/frame/button treatments and the splash screen that define the parchment look.

### Modified Capabilities
None. `hud-presentation` and the aurora background are defined in the still-unarchived changes `hud-tailwind-cards` and `aurora-background`, not in `openspec/specs/`, so they cannot take a delta. `parchment-theme` states the new surface/typography/contrast rules and supersedes the dark-glass look and aurora background from those changes; layout, card and motion rules there are unchanged.

## Impact

- `apps/client/src/style.css` (tokens, fonts, remove aurora), `apps/client/index.html` (font preload, theme-color), `apps/client/src/components/ui/*`, `apps/client/src/hud/*` (class changes; StartScreen/Lobby/SavedGames markup), new `apps/client/src/hud/Splash.tsx`, `apps/client/public/fonts/*`.
- No rules-engine, server or protocol changes. No new runtime dependencies (fonts are static files).
- Visual/e2e tests with hard-coded dark colours or text need updating; screenshots refreshed.
