## Why

The HUD is styled by about 950 lines of hand-written CSS across `style.css`, `hud/hud.css` and `hud/layout.css`, with a single breakpoint and ad-hoc class names. That makes every layout or responsive tweak slow and fragile. Resources are also shown as text chips ("Brick 3"), which reads like a spreadsheet rather than a board game. The board now has painted terrain tiles, but the cards in hand don't share that look.

## What Changes

- **Styling foundation**: adopt Tailwind CSS v4 (Vite plugin) and shadcn/ui (copied-in components built on Radix primitives) in `apps/client`. The design tokens move from the `--hud-*` CSS variables into a Tailwind theme with the same palette, so the look stays recognizably Hexfall.
- **Migration**: every HUD component (start screen, lobby, player panels, turn bar, build bar, hand, development cards, dialogs, maritime panel, log, toasts, credits, board-style switch) moves to Tailwind utilities and shadcn primitives (Button, Dialog, Card, Badge, Tooltip, Sheet for the mobile log). `hud/hud.css` and `hud/layout.css` are removed. `style.css` keeps only the page shell, the aurora background and the Tailwind entry.
- **Responsive layout**: replaces the single 768 px breakpoint with mobile, tablet and desktop layouts. All controls stay reachable, and nothing overlaps at 360 px wide.
- **Resource cards**: brick, grain, lumber, ore and wool become picture cards, like a physical card game:
  - Rounded portrait cards with a frame and the resource name in small caps.
  - Card art is cropped from the current terrain tiles (hills → brick, fields → grain, forest → lumber, mountains → ore, pasture → wool) by a reproducible script.
  - Cards are used in the hand (stacked fans with a count badge), discard, Year of Plenty, Monopoly and maritime trade dialogs, and build-cost hints.
  - Text labels remain for screen readers.
- **Development cards** get the same card frame, with a plain icon and title (no new illustrations).
- **Minimal animations** (CSS transitions only, all at most 200 ms):
  - a card lifts on hover or focus;
  - gained cards slide in, spent cards fade out;
  - dialogs fade and scale in.

  All motion is off under `prefers-reduced-motion`.
- Game rules, protocol, server and 3D scene are untouched. Behavior and accessibility of every HUD control stay the same.

## Capabilities

### New Capabilities
- `hud-presentation`: how the HUD looks and adapts. It covers the responsive layout breakpoints, resource and development cards drawn as picture cards, card art derived from the theme's terrain tiles, minimal motion with a reduced-motion opt-out, and accessible names that don't depend on images.

### Modified Capabilities
<!-- none: HUD behavior (specs/game-hud in the open client-3d change) is unchanged; this change only adds presentation requirements. -->

## Impact

- **Dependencies (client)**:
  - `tailwindcss` and `@tailwindcss/vite` (v4);
  - for shadcn, the Radix packages actually used (`@radix-ui/react-dialog`, `-tooltip`, `-slot`), `class-variance-authority`, `clsx`, `tailwind-merge`, and `lucide-react` for dev-card and UI icons.

  All of these are pinned.
- **Config**:
  - `apps/client/vite.config.ts` (Tailwind plugin, `@/` alias);
  - `apps/client/tsconfig.json` (`paths`);
  - `apps/client/components.json` (shadcn);
  - `apps/client/src/components/ui/*` (generated primitives);
  - `apps/client/src/lib/utils.ts` (`cn`).
- **Code**: all of `apps/client/src/hud/*.tsx`, `apps/client/src/App.tsx`, and `apps/client/src/style.css`. `hud/hud.css` and `hud/layout.css` are deleted.
- **Assets**:
  - new `tools/cards-from-tiles.mjs` (uses `sharp`, dev-only in `@hexfall/tools`);
  - generated `apps/client/public/cards/{brick,grain,lumber,ore,wool}.webp`, CC0 because they derive from the project's own CC0 tiles.
- **Tests**: HUD tests that select by `.hud-*` class names move to roles and `data-testid`/`data-*` hooks. New tests cover cards and reduced motion.
- **Overlap**: the open `client-3d` change still owns the `game-hud` behavior spec, and this change leaves its requirements untouched. The pending `aurora-background` styling in `style.css` is kept as is.
