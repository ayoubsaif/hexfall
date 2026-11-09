## Why

New players have no in-app way to learn the Catan rules: the HUD assumes they already know what each button does, why a placement is illegal, or what happens on a 7. Buttons also feel flat — there is no clear "this is live" feedback on hover — and long-press on mobile selects text instead of doing anything useful.

## What Changes

- **Tutorial mode**: on by default for first-time visitors. While on, game controls carry rule helpers (what the action does, its cost, and the rule that limits it), and a short phase hint explains what the player must do now (roll, discard, move the robber, place a settlement…). The player can turn it off from the hint itself or from Settings; the choice is stored in a cookie (`hexfall_tutorial`) so it stays off on later visits. It can be turned back on from Settings.
- **Hover card component**: a new `HoverCard` UI primitive (Radix HoverCard, parchment style, portalled into the HUD root). On mouse it opens on hover/focus; on touch it opens on a press-and-hold (~450 ms) without triggering the button's tap action, and closes on tap outside. Tutorial helpers use it.
- **No text selection app-wide**: `user-select: none` on the whole app (plus `-webkit-touch-callout: none`), with text fields (inputs, textareas, chat composer) kept selectable, so press-and-hold never selects text or pops the system menu.
- **Rules guide**: an info (ⓘ) button on the start screen and in the in-game top bar opens a "How to play" dialog covering the base rules (setup, turn, production, building, robber, development cards, trading, special cards, winning), each section with an illustration. Illustrations are painted once with the Gemini image API by a new `tools/rules-art-gen.mjs` script (same pattern as `dev-cards-gen.mjs`) and committed as WebP; the client never calls Gemini.
- **Button light hover**: main buttons and HUD action buttons get a dark mask by default; on hover/focus the mask lifts and a soft light glows on the button under the pointer. Pressed darkens again; disabled keeps the mask with no light.

## Capabilities

### New Capabilities
- `tutorial-mode`: tutorial on/off state, cookie storage, Settings toggle, rule helpers on controls, phase hints.
- `hover-cards`: the HoverCard primitive, hover vs. press-and-hold behaviour, app-wide no-select rule.
- `rules-guide`: the info button, the illustrated "How to play" dialog and how its art is produced.

### Modified Capabilities
- `illustrated-hud-style`: adds the default dark mask and hover light requirement for buttons and HUD actions.

## Impact

- Client UI: new `components/ui/hover-card.tsx`, `store/tutorial.ts` (cookie), `hud/RulesGuide.tsx`, tutorial helpers wired into `hud/actions/*`, `hud/Hud.tsx`, `hud/StartScreen.tsx`, `settings/*`; `button.tsx` and `style.css` for the mask/light and no-select rule.
- i18n: new `rules` and `tutorial` strings in `en` and `es`.
- Assets: ~9 new WebP illustrations under `apps/client/public/rules/`; `tools/check-assets.mjs` may need to know them; service worker cache list if assets are enumerated.
- Tooling: new `tools/rules-art-gen.mjs`, needs `GEMINI_API_KEY` in `.env` (gitignored) and costs API credits when run.
- Dependencies: none new (`radix-ui` already includes HoverCard).
- Rules engine: unchanged. Helper text describes the rules in AGENTS.md; legality still comes from the engine.
