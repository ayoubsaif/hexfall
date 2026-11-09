## Context

See proposal.md (Why). Relevant current state:

- UI primitives live in `apps/client/src/components/ui/` (shadcn on Radix). `tooltip.tsx` portals into the HUD root via `useHudRoot()`; the `radix-ui` package already ships HoverCard, so no new dependency.
- Viewer preferences use `localStorage` (`store/prefs.ts`, zustand). The user asked for a **cookie** for the tutorial switch, so it gets its own tiny store rather than a `Prefs` field.
- Game phase comes from the server view: `rollForOrder | setup | turn (rolled or not) | discard | moveRobber | roadBuilding | ended`. `game/status.ts` already turns this into a one-line status, and `LegalActions` already says which controls are enabled.
- Buttons: `components/ui/button.tsx` (cva variants) and the round HUD `hud/actions/Fab.tsx`. Framed buttons already use `::before` for corner ornaments (`.frame::before`, `z-index: 1`), so `::after` is the free pseudo-element.
- Art scripts in `tools/` (`dev-cards-gen.mjs`, `harbor-icons-gen.mjs`) call Gemini with `GEMINI_API_KEY` from `.env`, crop with `sharp`, and write WebP to `apps/client/public/`.

## Goals / Non-Goals

**Goals:** one reusable `HoverCard` with a touch long-press path; tutorial content that is pure data (state → text) and unit-testable; a CSS-only mask/light that works with `asChild` and corner ornaments.

**Non-Goals:** a scripted step-by-step tutorial game or a separate "tutorial room"; changing any rule or legality check; calling Gemini at runtime; localizing illustrations (they contain no text).

## Decisions

1. **Cookie store, not prefs.** `store/tutorial.ts` exposes `useTutorial()` (`enabled`, `setEnabled`) backed by `document.cookie` (`hexfall_tutorial=on|off; Path=/; Max-Age=31536000; SameSite=Lax` + `Secure` on https). Read once at startup; write wrapped in try/catch, falling back to in-memory state. Pure `parseTutorialCookie(cookieString)` / `serializeTutorialCookie(value, https)` functions for tests. *Alternative:* a `Prefs` field in localStorage — rejected because the user asked for cookies explicitly. The server never reads it (it is tiny and harmless in requests; no server change).

2. **`HoverCard` wrapper with a long-press hook.** `components/ui/hover-card.tsx` wraps Radix HoverCard (`openDelay 300`, `closeDelay 150`), portals into `useHudRoot()`, and styles like `TooltipContent` (paper, gold border, square). Radix HoverCard ignores touch, so the wrapper makes the card **controlled** and adds `useLongPress` (`hooks/use-long-press.ts`): on `pointerdown` with `pointerType === "touch"` start a 450 ms timer; cancel on move > 10 px, `pointerup` before the timer, or `pointercancel`. When it fires: open the card, set a "suppress next click" flag consumed in a capture-phase `click` handler on the trigger, and `preventDefault` on `contextmenu`. Outside tap closes via `onPointerDownOutside`. Keyboard focus opens it (Radix does this for HoverCard triggers on focus only partially, so the wrapper also opens on `focus-visible`). *Alternative:* Radix Popover for touch + HoverCard for mouse — two components to keep in sync; rejected.

3. **Helper wraps, never replaces, the existing tooltip.** `TutorialHelp` takes `{ topic, children }`. When tutorial is off it renders `children` untouched (existing `Tooltip` keeps working). When on, it renders the `HoverCard` around the trigger and suppresses the plain tooltip for that control (Fab gets a `help` prop; when present and tutorial is on, the Radix Tooltip is not mounted) to avoid two popups.

4. **Tutorial content is data.** `tutorial/topics.ts` maps a topic id (`road`, `settlement`, `city`, `devBuy`, `knight`, `roadBuilding`, `yearOfPlenty`, `monopoly`, `roll`, `endTurn`, `maritime`, `trade`, `robber`, `discard`) to i18n keys for title / body / cost. `tutorial/blockers.ts` turns the view + legal actions into a "why not" key (missing resources computed from cost minus hand, pieces left, not rolled yet, card bought this turn, already played a card, not your turn). `tutorial/hint.ts` maps the phase (+ `rolled`, viewer vs active seat, setup step) to `{ key, rulesSection }`. All pure and tested; components only render. Text mirrors AGENTS.md wording so rule changes have one place to check.

5. **Phase hint placement.** A small parchment card anchored under the top bar on the left on desktop and above the hand on mobile (`short:` / `max-sm:` variants), never over the action FABs; collapsible to an ⓘ chip for the rest of the game (session state, not the cookie). Contains "Learn more" (opens guide at `rulesSection`) and "Turn off tutorial".

6. **Rules guide is a Dialog.** `hud/RulesGuide.tsx` uses the existing `Dialog` (brass frame), a section list (tabs on desktop, a select-like stepper on mobile), and previous/next. Opening state lives in a small zustand slice `store/rulesGuide.ts` (`open(section?)`) so the start screen, top bar and tutorial hint can all open it. Text in new i18n namespace `rules` (en + es). Images `<img src="/rules/<section>.webp" alt=…>` with `loading="lazy"`, fixed aspect box so a failed load leaves blank space, not a collapse.

7. **Art generation script.** `tools/rules-art-gen.mjs` copies the `dev-cards-gen.mjs` structure (env loader, same STYLE string adapted to 16:9 landscape, `--force`, per-section filter), outputs 960×540 WebP to `apps/client/public/rules/<section>.webp`. Prompts describe scenes (a hex island with settlements, a robber on a hex, merchants trading…) with "no text". Add a `rules:art` npm script. Running it is a manual, credit-spending step done by the developer; generated files are reviewed and committed. `tools/check-assets.mjs` gains the 10 expected files.

8. **No-select rule.** In `style.css` base layer: `html, body, #root { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }` and `input, textarea, [contenteditable="true"], .selectable { user-select: text; -webkit-user-select: text; }`. Also `-webkit-tap-highlight-color: transparent` on buttons. Images get `-webkit-user-drag: none`.

9. **Mask and light in CSS on `::after`.** A shared `.btn-light` class (added by the button cva base for `default | secondary | destructive | menu`, and by `Fab` and action-bar buttons) sets `isolation: isolate; position: relative` and an `::after` with `z-index: -1; inset: 0; pointer-events: none; border-radius: inherit` whose background is
   `radial-gradient(circle at var(--lx,50%) var(--ly,50%), rgb(255 230 170 / var(--light,0)) 0, transparent 60%), rgb(0 0 0 / var(--mask,.14))`.
   With `isolation`, a `z-index:-1` child paints above the button's own background but below its content and below the `::before` corners (z 1), so text/icons/badges stay at full contrast and it works with `asChild` (no extra DOM child). `:hover`/`:focus-visible` → `--mask: 0; --light: .35`; `:active` → `--mask: .26; --light: 0`; `:disabled, [aria-disabled=true]` → no hover change. `@media (hover: hover)` guards the hover state so touch does not stick. `transition: --mask/--light` needs `@property` registrations for `--mask` and `--light` (numbers) to animate; `prefers-reduced-motion` and the app's `motion: reduce` class drop the transition. Pointer position: one delegated `pointermove` listener on `document` (passive, rAF-throttled) sets `--lx/--ly` on the hovered `.btn-light` element. The existing `hover:brightness-125` / `.game-mode-button:hover { filter }` rules are removed so the light replaces them. *Alternative:* a `<span>` light layer inside Button — breaks `asChild` and Fab layout; rejected.

## Risks / Trade-offs

- [Long-press suppresses a tap the player meant] → only after the 450 ms timer fires; a normal tap is < 300 ms. Covered by a test that a short press still clicks.
- [`z-index:-1` hidden by a button with an opaque child background] → audit Fab and action bar; those children are transparent today.
- [`@property` unsupported in an old browser] → values still switch, just without the fade.
- [Global `user-select: none` blocks copying a room code or error text] → room code / share link elements get the `.selectable` class; list them in tasks.
- [Helper text drifts from the engine rules] → text keys reference AGENTS.md sections in comments; blockers come from `LegalActions`, not re-implemented legality.
- [Gemini output varies or includes text] → developer reviews images before committing; script keeps existing files unless `--force`.
- [Cookie banner/consent] → the cookie is strictly functional (stores a UI choice only); no tracking, no third party.

## Migration Plan

Client-only, ships with the next deploy. Existing visitors have no cookie, so they will see the tutorial once and can turn it off. Rollback = revert the client; a leftover cookie is ignored.

## Open Questions

- Exact wording and art direction of each illustration prompt — tuned while running the script.
