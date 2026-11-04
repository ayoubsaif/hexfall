## Why

The page background is a flat dark navy (`#0e2a3d`). The game's terrain palette — ocean teal, forest green, grain amber, brick red — lives in HUD CSS vars but never reaches the ambient chrome. A moving aurora effect ties the UI's atmosphere to the game world at near-zero runtime cost.

## What Changes

- `html/body/#root` background colour changes from `#0e2a3d` to `#060e14` (near-black).
- Two CSS pseudo-elements (`.app::before`, `.app::after`) add softly drifting radial-gradient blobs using existing `--hud-*` colour vars.
- Two `@keyframes` rules (`aurora-a`, `aurora-b`) drive transform-only animations (no repaint).
- `prefers-reduced-motion` rule disables animations for accessibility.

## Capabilities

### New Capabilities

_None — no new behaviour._

### Modified Capabilities

_None — pure visual styling, no requirement changes._

## Impact

- `apps/client/src/style.css` — only file touched.
- No changes to Three.js scene, theme system, TypeScript, or tests.
- `color-mix(in srgb, ...)` required; supported Chrome 111+, Firefox 113+, Safari 16.2+.
