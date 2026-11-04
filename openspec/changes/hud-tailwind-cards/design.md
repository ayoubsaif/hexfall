## Context

- See proposal.md "Why". The HUD is 14 React components in `apps/client/src/hud/`, styled by `hud/hud.css` (535 lines), `hud/layout.css` (165 lines, one breakpoint) and the shell part of `style.css`. The shell part covers the design tokens (`--hud-*`), the connection badge, buttons, the board-style switch, credits, and the aurora background.
- The HUD is a DOM overlay above the R3F canvas. The container ignores the pointer, and interactive children opt in through `data-interactive` / `pointer-events: auto`. That contract must survive the migration, or clicks stop reaching the board.
- Tests in `apps/client/test/hud/` select about 20 `.hud-*` class names. Behavior is specified in the open `client-3d` change (`game-hud`) and must not change.
- Toolchain: Vite+ (`vp`) wraps Vite, using React 19 and TypeScript 7. The lint has type-aware rules, and `vite-plus/prefer-vite-plus-imports` is enforced.
- Terrain tiles are 1024 × 1024 top-down hex paintings in `public/themes/diorama/tiles/` (CC0, our own). Hills and fields are RGBA, and the others RGB.

## Goals / Non-Goals

**Goals:**
- Utility-first styling with a small set of accessible primitives, so layout changes become one-line edits.
- A HUD that looks like a physical table game: cards with art and frames, compact and readable.
- Three responsive layouts with no overlap down to 360 px.

**Non-Goals:**
- No new HUD behavior, game rules, protocol or 3D-scene changes. Domestic trade stays in the future `trading` change.
- No new illustrations. Development cards use icons, not painted art.
- No theming of cards by the asset-theme system. The asset key set is frozen while `board-topology` is open, so the card images are HUD-owned files (see Decision 4).
- No JS animation library.

## Decisions

1. **Tailwind CSS v4 via `@tailwindcss/vite`.** It uses CSS-first config: tokens go in `@theme` in `style.css`, with no `tailwind.config.js`.
   - The existing `--hud-*` palette maps to theme colors (`bg-hud`, `text-hud-fg`, `accent`, `ok`, `wait`, `bad`), plus five resource colors (`res-brick`, `res-grain`, …).
   - The breakpoints are set to the spec's widths: `sm` = 640 px, `lg` = 1024 px. The short-screen rule is a custom variant, `@custom-variant short (@media (max-height: 599px))`, plus `landscape` (short and at least 640 px wide), which moves the bottom stack into a right-hand column beside the board. Tailwind emits `short:` after `landscape:`, so the few conflicting `landscape:` utilities carry the `!` modifier. The canvas is never resized: it stays a full-screen background, and the camera fits the island to the whole viewport (owner decision after trying an inset canvas and a camera view offset).
   - *Alternative*: Tailwind v3 with PostCSS. Rejected, because v4 has a first-party Vite plugin and needs no config file.
   - *Risk*: compatibility with Vite+. It is checked first, in task 1.1.

2. **shadcn/ui, copied in and kept minimal.** Generate only Button, Dialog, Card, Badge, Tooltip and Sheet into `src/components/ui/`, with `cn()` in `src/lib/utils.ts` and the `@/` alias in Vite and tsconfig.
   - These components are owned code, so they are edited to use our tokens and to keep `data-interactive` on interactive roots.
   - Dialogs replace the hand-rolled `Modal` and get focus trapping and Escape handling from Radix for free.
   - The Sheet becomes the mobile log drawer.
   - *Alternative*: use only Tailwind, with no component kit. Rejected: the user asked for shadcn, and Radix gives the dialogs accessibility we currently hand-roll.

3. **Radix portals stay inside the HUD.** Radix renders dialogs into `document.body` by default, outside `.hud`. The shared Dialog/Sheet wrappers pass `container` as the `.hud` root, so the pointer-events contract and stacking above the canvas hold.

4. **Card art lives in HUD-owned files, `public/cards/<resource>.webp`.**
   - They are made by `tools/cards-from-tiles.mjs` with `sharp` (dev-only in `@hexfall/tools`). For each resource it takes the matching tile, crops the largest centered 5:7 rectangle that fits inside the pointy-top hex's inscribed area (about 500 × 700 from the 1024 tile), and resizes it to 320 × 448. Then it applies a slight vignette and saturation +5 % for a printed-card feel, and encodes WebP at quality 80, with fixed options so the output is deterministic.
   - *Why not new theme keys*: `ASSET_KEYS` is spec'd as exactly 18 keys, and `board-topology` is mid-flight on that requirement. Adding `card.*` keys later is a clean follow-up.
   - The spec only requires that the art come from the active board's tiles. With one shipped theme this holds, and the script reads its tile paths from the diorama manifest, not hard-coded paths.

5. **One `<GameCard>` component** (`hud/cards/GameCard.tsx`) with three sizes: `sm` (cost hints, about 28 px wide), `md` (dialogs, about 56 px) and `lg` (hand, about 72 px desktop, 52 px mobile).
   - Props: `resource` or `dev`, `count`, `dimmed`, `disabled`, `interactive`.
   - It renders a 5:7 box with a frame color from the resource token, art as a CSS background (so a failed image just leaves the frame color, per the spec), a name ribbon, and a count `Badge`.
   - The accessible name comes from a visually hidden label (`Brick, 3`), and the art is `aria-hidden`.
   - `ResourceChip` is removed. `RESOURCE_LABEL` stays as the text source.

6. **Stacks in the hand.** A resource with a count of 2 or more draws up to 3 offset card edges behind the face card (pure CSS `box-shadow` layers), plus a count badge. A count of 0 shows a dimmed card. This keeps the hand a fixed 5-slot row, so the layout never jumps as counts change.

7. **Motion with CSS transitions and keyframes only, via Tailwind utilities.**
   - Hover/focus lift: `translate-y` with a 150 ms transition.
   - Gained card: `animate-card-in` (translate + fade, 180 ms), triggered by keying the card element on a per-resource "gain counter" that increments when the count rises.
   - Spent card: a 150 ms opacity dip, triggered the same way when the count falls.
   - Dialogs: the shadcn defaults, shortened to 150 ms.
   - A global `motion-reduce:` rule (`@media (prefers-reduced-motion: reduce) { .hud * { transition: none !important; animation: none !important } }`) satisfies the spec in one place.
   - *Alternative*: framer-motion. Rejected for bundle size and because of the "minimal" requirement.

8. **Test hooks.** Tests switch from `.hud-*` classes to roles, accessible names and a few `data-testid` attributes. During migration, components keep their old `hud-*` class names as inert hooks where a test still needs them, then drop them in the final cleanup task. This keeps every task green.

9. **Migration order**: foundation → GameCard → Hand/DevCards → dialogs → panels/turn/build → start/lobby/credits/badges → layout shell → delete the old CSS. Each step removes the CSS rules it replaces, so old and new styles never fight over the same element for long.

## Risks / Trade-offs

- **Tailwind v4 or Radix may not work with Vite+ or TypeScript 7.** → Task 1.1 is a spike: install, render one Button and one Dialog, run `vp build`, `vp test` and `vp lint`. If it fails, stop and report before any migration.
- **Tailwind preflight resets break existing styles.** For example, R3F canvas sizing or `button` defaults in un-migrated components. → Import preflight, check the canvas and the un-migrated HUD visually after task 1.x, and patch the shell styles in `style.css` right away.
- **Card art crop shows hex edges or transparency.** The RGBA tiles may have transparent corners. → Crop inside the inscribed area; the script asserts no transparent pixels in the output and fails otherwise.
- **The hand row is too wide at 360 px.** Five `lg` cards at 52 px plus gaps take about 300 px, which fits. Dev cards wrap to a second row, or a horizontal scroll strip inside the panel (never the page).
- **Bundle size.** Tailwind is build-time only. The Radix packages add about 25 KB gzip, which is acceptable.
- **Lucide icon semantics.** Icons are generic (shield, road, wheat, coins, star), never imitating another game's card art.

## Migration Plan

Tasks run in order on the main branch, and each one leaves `pnpm run test` green. To roll back, revert the change's commits: no data, protocol or server state is involved.

## Open Questions

- The exact frame colors per resource. They are tuned during task 2.x against the card art for the 4.5:1 label contrast, which doesn't affect specs or tasks.
