## 1. Foundation (Tailwind + shadcn)

- [x] 1.1 Spike: add `tailwindcss` and `@tailwindcss/vite` (v4, pinned) to `apps/client`, register the plugin in `vite.config.ts`, add `@import "tailwindcss"` to `style.css`, and render one utility-styled element. Verify: `vp dev` shows the style, and `vp build`, `vp test` and `vp lint` all pass. If any fails, stop and report.
- [x] 1.2 Add the `@/` alias (Vite `resolve.alias` + tsconfig `paths`), `components.json`, `src/lib/utils.ts` (`cn` with `clsx` + `tailwind-merge`) and `lucide-react`. Verify: a test imports `@/lib/utils` and `cn("p-2", "p-4")` returns `"p-4"`.
- [x] 1.3 Move the design tokens into `@theme` in `style.css`:
  - the `--hud-*` palette;
  - five resource colors;
  - breakpoints `sm` = 640 and `lg` = 1024;
  - the `short` (max-height 599 px) custom variant;
  - the `card-in` and `card-out` keyframes;
  - a global reduced-motion rule scoped to `.hud`.

  Keep the aurora shell. Verify: the 3D canvas still fills the page and the existing HUD looks unchanged, checked by screenshot at 1440 and 360 px.
- [x] 1.4 Generate the shadcn Button, Dialog, Card, Badge, Tooltip and Sheet into `src/components/ui/`, adapted to the tokens. Dialog and Sheet portal into the `.hud` root, and interactive roots carry `data-interactive`. Verify: a test opens a Dialog inside a rendered `Hud` and asserts that it is inside `.hud`, traps focus and closes on Escape.

## 2. Card art and the GameCard component

- [x] 2.1 Add `sharp` (pinned, dev-only) to `@hexfall/tools`, and write `tools/cards-from-tiles.mjs`. It reads the tile paths from the diorama manifest, crops a centered 5:7 rectangle inside the hex, resizes to 320 × 448, applies a light vignette, and writes WebP at quality 80 to `apps/client/public/cards/<resource>.webp`. Add a root script `cards:build`. Verify: a Vitest test in `tools/test/` checks:
  - two runs give byte-identical outputs;
  - each output is 320 × 448 WebP, ≤ 60 KB, with no transparent pixels.
- [x] 2.2 Run `pnpm run cards:build`, commit the five images, and add their provenance (derived from the CC0 diorama tiles) to `docs/art/README.md`. Verify: the five files exist, and `check-assets` passes.
- [x] 2.3 Build `hud/cards/GameCard.tsx`. It supports resource and dev variants, the sizes sm/md/lg, `count`, `dimmed`, `disabled` and `interactive`. The art is an `aria-hidden` background, with a hidden accessible label and a frame color per resource. Verify with RTL tests:
  - the accessible name is "Brick, 3";
  - the art element is `aria-hidden`;
  - a missing image still shows the frame and name;
  - disabled cards are not focusable as buttons;
  - frame and name colors meet 4.5:1 (computed from the tokens in the test).
- [x] 2.4 Add a gain/spend motion hook (`useCountChange`). It re-keys a card to play `card-in` on an increase and `card-out` on a decrease. Verify: a unit test checks that the key changes on an increase and that the class changes on a decrease, and that with `matchMedia('(prefers-reduced-motion: reduce)')` mocked true, no animation class is applied.

## 3. Migrate the HUD components

- [x] 3.1 Hand: a fixed five-slot row of `lg` GameCards with stacks for counts ≥ 2 and dimmed zero slots, plus the pieces-left line. Remove `ResourceChip` and its CSS. Verify: the spec scenario "Hand shows cards" as an RTL test, and the existing hand tests pass after their selectors are updated.
- [x] 3.2 DevCards: dev-variant GameCards with lucide icons, counts and a disabled state, with the accessible description "playable from your next turn" for cards bought this turn. A card plays on one activation. Verify: the spec scenario "Knight bought this turn", and the existing dev-card play tests pass.
- [x] 3.3 Dialogs: discard, Year of Plenty, Monopoly and victim on the shadcn Dialog, with `md` GameCards beside the steppers. Delete the hand-rolled `Modal`. Verify: the spec scenario "Discard dialog uses cards", and the existing dialog tests pass.
- [x] 3.4 MaritimePanel: the give and receive choices as `md` GameCards with the rate badge and the bank count. Verify: the existing maritime tests pass, and a new test asserts that the cards carry accessible names including the rate.
- [x] 3.5 BuildBar cost hints as `sm` GameCards, with a tooltip naming the cost in text. Verify: the spec scenario "Build-cost hint uses cards".
- [x] 3.6 PlayerPanels, TurnBar (dice), Feed (log, toasts, rejection, game over) and ReplacedNotice migrated to Tailwind and shadcn Card/Badge/Button, with the same content and roles. Verify: the existing tests pass with role- or testid-based selectors.
- [x] 3.7 StartScreen, Lobby, Credits, ConnectionBadge, ReloadBanner and the board-style switch migrated, the Credits dialog on the shadcn Dialog. Verify: the existing Hud, start, lobby and credits tests pass.

## 4. Responsive shell and cleanup

- [x] 4.1 Rebuild the `Hud.tsx` shell layout with Tailwind:
  - mobile (< 640 px or `short`): compact panels, the log as a Sheet drawer, 40 px minimum touch targets;
  - short and wide (`landscape`): board left, stack in a right-hand column;
  - tablet: two-row bottom stack;
  - desktop: side log always visible.

  The canvas area must stay clickable. Verify: screenshots at 360 × 740, 768 × 1024, 900 × 500 and 1440 × 900 with a live or injected game view show every spec scenario of "Responsive HUD layout" (no overlap, no horizontal scroll), and clicks on board targets still register.
- [x] 4.2 Delete `hud/hud.css` and `hud/layout.css`, strip the old HUD rules from `style.css`, and drop the leftover `hud-*` class hooks once no test uses them. Verify: `rg "hud\.css|layout\.css"` finds nothing, and `rg "className=\"hud-" apps/client/src` returns only the intended shell hooks.
- [x] 4.3 Motion check: in the running client, gain and spend cards and open a dialog with normal motion, then with reduced motion emulated (Chrome DevTools rendering). Verify: transitions last at most 200 ms and nothing animates continuously. With reduced motion there are no transitions, and a screenshot/GIF is shared with the owner.

## 5. Final checks

- [x] 5.1 Run `pnpm run check` and `pnpm run test`. Verify: both are green apart from failures already recorded in CHECKPOINT.md, and `vp build` succeeds with the client JS gzip size increase noted in CHECKPOINT.md.
- [ ] 5.2 Owner review: share desktop and phone screenshots of the hand, dialogs and panels. Verify: the owner approves, or their feedback is applied.
- [x] 5.3 Update `CHECKPOINT.md` (styling stack, `cards:build`, where the tokens live). Verify: the file mentions `hud-tailwind-cards`, Tailwind/shadcn and `pnpm run cards:build`.
