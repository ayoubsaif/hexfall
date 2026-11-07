## 1. Tokens and fonts

- [x] 1.1 Add paper/deep-paper/ink/ink-muted/forest/leather/gold tokens to `@theme` in `apps/client/src/style.css`; re-point `hud`, `hud-fg`, `hud-muted`, `background`, `foreground`, `primary`, `border`, `ring` to them
- [x] 1.2 Add self-hosted Cormorant Garamond + Manrope (latin, latin-ext, variable WOFF2) to `apps/client/public/fonts`, `@font-face` with `font-display: swap` and fallback metrics, `--font-serif`/`--font-sans`
- [x] 1.3 Preload the fonts in `index.html`, update `theme-color`. (`sw.js` has no fetch handler, so no precache)
- [x] 1.4 Add `.paper` surface and `.frame` corner-bracket utilities (CSS only, no images)
- [x] 1.5 Unit test: contrast ratio of every text/surface token pair >= 4.5:1

## 2. UI primitives

- [x] 2.1 Restyle `Button` (leather plaque default, paper secondary, ink ghost/link, selected state, 40px mobile targets)
- [x] 2.2 Restyle `Card`, `Dialog`, `Sheet`, `Input`, `Badge`, `Tabs`, `Switch`, `Slider`, `Tooltip`, `Sidebar` to paper tokens with visible 3:1 focus rings
- [x] 2.3 Sweep `text-white|bg-white|border-white|bg-black|white/` utilities in `apps/client/src` and replace with tokens

## 3. Start, lobby and saved games

- [x] 3.1 Rebuild `StartScreen` as the parchment card (serif title, description, saved-games tile, name field, create/join) with unchanged behaviour and validation
- [x] 3.2 Restyle `Lobby`, `SavedGames`, `GamePause`, `ReplacedNotice` to the same card/tile language
- [x] 3.3 Add i18n strings for new headings and descriptions in all supported languages (`labels.ts`)
- [x] 3.4 Check 360x740: no horizontal scroll, card scrolls vertically

## 4. In-game HUD

- [x] 4.1 Restyle `PlayerPanels` (paper at >=90% opacity, coloured edge for player colour), `Hand`, `DevCards`, `cards/*`, resource frames (re-check 3:1 against paper)
- [x] 4.2 Restyle `TradePanel`, `MaritimePanel`, `OffersTray`, `Dialogs`, `actions/*`
- [x] 4.3 Restyle `Feed` (log), `DiceStats`, `dice/*` readout, `StatusPill`, `TurnFocus`, `GameAlerts`, `Credits`
- [x] 4.4 Restyle the settings dialog and its sidebar
- [ ] 4.5 Confirm responsive layout unchanged at 360x740, 900x500, 1440x900 (no overlap, no horizontal scroll)

## 5. Background and splash

- [x] 5.1 Remove aurora pseudo-elements and keyframes; add static vignette on `.app`
- [x] 5.2 Build `hud/Splash.tsx`: double border, eyebrow, title, tagline, progress bar, rotating tips (6 s, pause, next), CSS/SVG hex illustration
- [x] 5.3 Mount the splash from the theme/model load state; it never delays a ready app; honour reduced motion (no animation, no auto-rotate)
- [x] 5.4 Add splash i18n strings (eyebrow, tagline, 5 tips, pause/next labels)

## 6. Verify and wrap up

- [x] 6.1 Update tests that assert old dark classes/colours; keep test ids and roles
- [x] 6.2 Add tests: splash tip controls and reduced motion (done), selected tile `aria-pressed`, no third-party font request (done)
- [x] 6.3 Run typecheck, lint and test suites; fix failures
- [ ] 6.4 Screenshot start, lobby, game HUD at the three viewport sizes and compare with the reference style
- [ ] 6.5 Update README/docs screenshots if present; note in archive that this supersedes dark glass (`hud-tailwind-cards`) and aurora (`aurora-background`)

## 7. Cards (added during apply)

- [x] 7.1 Square card corners (`rounded-none`) on resource and development cards
- [x] 7.2 Generate painted art for the 5 development cards with `tools/dev-cards-gen.mjs` (Gemini `gemini-nano-banana-2.1`, key in gitignored `.env`) into `apps/client/public/cards/dev/`
- [x] 7.3 Draw dev card art in `GameCard` from `devCardArtUrl`; remove the icon overlay and `DEV_ICON`

## 8. Board views, terrain relief and water (added mid-apply, owner request)

- [x] 8.1 View presets: `store/view.ts`, `scene/viewPresets.ts`, `scene/CameraRig.tsx` (450 ms glide, jump under reduced motion), `hud/ViewControls.tsx` (default / top-down centered / diagonal) next to the settings button in game; i18n `board.view*` (en, es)
- [x] 8.2 Tall rounded land: `landBlockGeometry` (domed top, rounded shoulder, earth-gradient walls); `LAND_THICKNESS` 0.95, `SEA_DEPTH` 0.55, per-terrain `DOME_AMPLITUDE`; raised for top-down terrain images too (`LandRelief.isometric` keeps the old camera limits for isometric art); tokens lifted to the dome top
- [x] 8.3 Procedural sea (`scene/Water.tsx`): lit swell, Fresnel sky tint, glint, shore-following foam waves; sea tile image and manifest entry removed
- [x] 8.4 Tests: `test/scene/viewPresets.test.ts`, relief tests updated
- [x] 8.5 Live game with two bots (setup, roll, 7, robber move, view buttons): dice settle fine on domes; the robber was buried in a dome, now lifted by the dome height. Not checked: ViewControls at 360x740 (the browser window would not resize)

## 9. Entry menu refinement (owner request)

- [x] 9.1 Add the local parchment surface and defer the board canvas until room entry
- [x] 9.2 Replace the island illustration with large host/solo/join buttons using existing gold icons
- [x] 9.3 Open focused mode forms, retain invite-link behavior and validation, and add a back action
- [x] 9.4 Verify mode actions, translations, responsive entry layout and board mount/unmount; build the client

## 10. Turn status label (owner request)

- [x] 10.1 Move the turn status pill into the top bar under the view controls and give it the view-controls look (dark translucent leather, gold border, cream text, gold "your move" text) for contrast over the board

## 11. Hand cards (owner request)

- [x] 11.1 Hand slots rest at 80 % visible (was half hidden) and still rise fully on hover or focus
- [x] 11.2 Development cards drop their name strip like resource cards; the name (and why a card is blocked) moves to a tooltip
- [x] 11.3 Stacks of two or more fan out upward on hover or focus, one ghost per extra card (up to 8), each showing 20 % behind the one in front; the tooltip clears the fan
