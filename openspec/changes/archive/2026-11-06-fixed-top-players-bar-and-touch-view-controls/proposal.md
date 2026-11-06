## Why

Player panels and the view controls now share one wrapping column at the top-left. The panels reflow (wrap to a second row) as names and badges change, so the controls below shift around, and the wide leather-themed zoom bar eats board space. Touchscreen and touchpad users also get a control style that feels foreign next to the map gestures they already know from Google Maps.

## What Changes

- Player panels live in a **fixed top container**: one non-wrapping row pinned to the top edge of the HUD, with a stable height regardless of badges, countdowns or offline state (cards shrink/truncate instead of wrapping).
- The board/map **view controls move directly under that container** (not beside or above it) and become **thinner**: lower height, tighter padding, smaller hit-area on mouse, slimmer slider.
- When the active input is **touchscreen or touchpad**, the view controls take a **Google Maps look**: a compact stacked white/light rounded-square pair of zoom `+` / `−` buttons with a hairline divider, soft shadow, plus separate round view-preset buttons in the same style; no slider, no percent text. Zoom still goes through the same `requestZoom` path.
- When the active input is **mouse**, the current leather/gold bar is kept as is (only thinner per above).
- Input kind (`mouse` | `touch` | `touchpad`) is detected from pointer events and the existing wheel classifier, and held in the view store.

## Capabilities

### New Capabilities
- `hud-top-bar`: fixed top player-panel container, view controls placed right after it, thin sizing.
- `view-controls-input-theme`: input-kind detection and the Google Maps-style theme for touch/touchpad vs. the unchanged mouse theme.

### Modified Capabilities
<!-- None: HUD/camera requirements still live in unarchived changes (improve-touch-camera-and-hud-layout, hud-tailwind-cards), not in openspec/specs. -->

## Impact

- `apps/client/src/hud/Hud.tsx` (top layout), `PlayerPanels.tsx` (no-wrap, fixed height), `ViewControls.tsx` (two themes, thinner).
- `apps/client/src/store/view.ts` (input kind state), `apps/client/src/scene/useGestures.ts` / `gestures.ts` (report touchpad vs mouse wheel).
- Client tests: `apps/client/test/hud/*`. No server, protocol or rules-engine changes.
- Overlap risk with in-flight change `improve-touch-camera-and-hud-layout` (same HUD files); apply after or reconcile.
