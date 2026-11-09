## 1. Hover card primitive and no-select

- [x] 1.1 Add `hooks/use-long-press.ts` (450 ms, 10 px move cancel, touch only, suppress-next-click flag) with tests for: hold opens, short tap still clicks, move cancels, pointercancel cancels — `pnpm test` passes
- [x] 1.2 Add `components/ui/hover-card.tsx` wrapping Radix HoverCard (open 300 ms / close 150 ms, focus opens, Escape closes, portal into `useHudRoot()`, parchment square style, controlled open for long-press, outside tap closes, `contextmenu` prevented) with a component test covering mouse hover, focus and long-press — tests pass
- [x] 1.3 Add the app-wide `user-select: none` / `-webkit-touch-callout: none` / tap-highlight rules to `style.css`, keep `input`, `textarea`, `[contenteditable]` and `.selectable` selectable, and add `.selectable` to the lobby room code and invite link — verify in the browser that long-pressing a heading selects nothing and chat input text can be selected

## 2. Button dark mask and hover light

- [x] 2.1 Add `.btn-light` CSS in `style.css` (`@property --mask/--light`, `isolation: isolate`, `::after` at `z-index:-1` with radial light + dark mask, hover/focus-visible/active/disabled states under `@media (hover: hover)`, no transition for reduced motion) and verify corner ornaments (`::before`) still render above it
- [x] 2.2 Apply `.btn-light` in the `button.tsx` cva base for `default`, `secondary`, `destructive`, `menu` (not `ghost`/`link`), remove `hover:brightness-*` and `.game-mode-button:hover` filter rules — existing button tests still pass
- [x] 2.3 Apply `.btn-light` to `hud/actions/Fab.tsx` and the action-bar buttons in `hud/actions/ActionButtons.tsx`; confirm icons, badges and countdown rings draw above the mask
- [x] 2.4 Add a delegated, passive, rAF-throttled `pointermove` listener (mounted once in `App.tsx`) that sets `--lx/--ly` on the hovered `.btn-light` element; unit-test the coordinate helper — then check in the browser that the light follows the pointer, disabled buttons stay dark, and touch does not leave a stuck light

## 3. Tutorial state (cookie)

- [x] 3.1 Add `store/tutorial.ts` with pure `parseTutorialCookie` / `serializeTutorialCookie` (`hexfall_tutorial=on|off; Path=/; Max-Age=31536000; SameSite=Lax`, `Secure` on https) and a zustand `useTutorial` store defaulting to on, falling back to memory when cookie write throws — unit tests cover no cookie, `on`, `off`, garbage value, write failure
- [x] 3.2 Add a "Tutorial" switch to Settings (new row in an existing section, e.g. `AccessibilitySection.tsx`, or a new `TutorialSection.tsx` registered in `settings/sections.ts`) bound to `useTutorial` — settings test toggles it and asserts the cookie string

## 4. Tutorial content

- [x] 4.1 Add `tutorial/topics.ts` (topic ids → i18n keys for title, body, cost) for road, settlement, city, devBuy, knight, roadBuilding, yearOfPlenty, monopoly, roll, endTurn, maritime, trade, robber, discard; add en + es strings in a new `tutorial` locale namespace matching AGENTS.md rules — i18n type check (`pnpm check`) passes
- [x] 4.2 Add `tutorial/blockers.ts` that derives a "why unavailable" key (+ missing resources) from `PlayerView` and `LegalActions` (not your turn, roll first, missing resources, no pieces left, deck empty, card bought this turn, already played a card) — unit tests per blocker
- [x] 4.3 Add `tutorial/hint.ts` mapping phase (`rollForOrder`, `setup` settlement/road and first/second round, `turn` before/after roll, `discard`, `moveRobber` seven/knight, `roadBuilding`, waiting on others) to `{ key, rulesSection }` — unit tests per phase

## 5. Tutorial UI

- [x] 5.1 Add `hud/tutorial/TutorialHelp.tsx` (renders children unchanged when tutorial is off; otherwise wraps them in `HoverCard` with topic text, cost chips and blocker line) and a `help` prop on `Fab` that replaces the plain tooltip while tutorial is on — component test: off shows tooltip only, on shows hover card only
- [x] 5.2 Wire helpers onto build road/settlement/city, buy dev card, each dev card play, roll, end turn, maritime trade, player trade, the robber/victim prompt and the discard dialog — verify each by hovering (desktop) and long-pressing (mobile viewport) in the browser
- [x] 5.3 Add `hud/tutorial/PhaseHint.tsx` (placement per design decision 5, collapse to chip for the session, "Learn more" opens the guide at the hint's section, "Turn off tutorial") and mount it in `Hud.tsx` — component test: hint text changes with phase, turn-off hides helpers and hint and writes the cookie

## 6. Rules guide

- [x] 6.1 Add `store/rulesGuide.ts` (`open(section?)`, `close`) and `hud/RulesGuide.tsx` dialog with the 10 sections in spec order, section list + previous/next, opening at a requested section, `img` with alt text inside a fixed-aspect box — component test: default opens at Goal with previous disabled, `open("robber")` shows the robber section, broken image keeps text
- [x] 6.2 Write the rules guide text in a new `rules` locale namespace (en + es) following AGENTS.md sections 1–12 exactly, no house rules — `pnpm check` passes
- [x] 6.3 Add the info button ("How to play", accessible name) to `StartScreen.tsx` and the in-game top bar in `Hud.tsx`, mount `RulesGuide` once in the HUD root — verify in the browser that it opens from both places and the game state does not change
- [x] 6.4 Shrink the illustration to a thumbnail/banner and add a per-section strip of real game pieces (`hud/RulesVisuals.tsx`: resource/dev cards, piece icons, cost cards, dice, trade rates, token odds, VP) with en + es captions — rules-guide test checks every section has a strip

## 7. Illustrations (Gemini)

- [x] 7.1 Add `tools/rules-art-gen.mjs` modelled on `tools/dev-cards-gen.mjs` (env loader, shared painted style, 16:9 → 960×540 WebP to `apps/client/public/rules/<section>.webp`, `--force`, section filter, "no text" in prompts) and a `rules:art` script in the root `package.json` — `node tools/rules-art-gen.mjs --help`-style dry run lists the 10 sections without calling the API
- [x] 7.2 Ask the user before running the generator (it uses their `GEMINI_API_KEY` and spends credits); after it runs, review the 10 images for stray text and style match, then commit them
- [x] 7.3 Add the 10 rules images to `tools/check-assets.mjs` (and to the service worker precache list if assets are enumerated there) — `pnpm check` passes

## 8. Verification

- [x] 8.1 Run `pnpm check` and `pnpm test` — all pass
- [ ] 8.2 In the browser (desktop and mobile viewport, en and es): first visit shows tutorial, turning it off persists across reload via the cookie, Settings turns it back on, hover cards work on hover/focus/long-press without firing taps, no text gets selected, buttons show the mask and light, and the rules guide opens with illustrations from the start screen, the top bar and the hint
