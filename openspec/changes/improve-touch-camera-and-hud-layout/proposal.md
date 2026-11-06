## Why

Camera control only works well with a mouse (left-drag orbit, right-drag pan, wheel zoom). Touchpad users have no right button, and phone users get no tested, documented gestures. Separately, the in-game HUD is crowded: Settings, view presets, host menu and connection badge stack in the bottom-left, the Log button is a wide text button, and the dice tray is a paper card that floats over the board. Controls overflow on small screens.

## What Changes

- **Camera gestures**: define and test one gesture set for mouse, touchpad and touchscreen.
  - Touchpad: two-finger scroll pans the camera (replaces right-drag/right-click-drag); pinch (ctrl+wheel) zooms; two-finger scroll must not scroll or zoom the page.
  - Touchscreen: one finger orbits, two fingers pan and pinch-zoom (and twist is ignored).
  - Mouse behavior unchanged (left orbit, right pan, wheel zoom).
  - Gestures never fight with tapping a piece, target or button (a tap is not a drag).
- **Dice presentation**: remove the paper card behind the dice tray. Show a 3D-rendered dice illustration (no card border/background) docked at the bottom, and the same borderless illustration enlarged at screen center during the your-turn focus. The total stays next to it as text.
- **HUD compaction** (see the annotated screenshot):
  - Settings button sits in the same row as the pause/end-game button.
  - Log button becomes icon-only (same style as Settings) and joins that row.
  - Connection status becomes a compact indicator (dot + ping) in the same bottom row, text on hover/focus only.
  - Dice control moves to the bottom row, so all controls fit one bottom band without overlap on phones, tablets and desktop.
- Test and fix touchpad and touchscreen use end to end (manual device matrix plus automated pointer-event tests).

## Capabilities

### New Capabilities
- `camera-gestures`: input mapping for orbit/pan/zoom across mouse, touchpad and touchscreen, plus tap-vs-drag disambiguation and page-scroll suppression.
- `hud-compact-controls`: icon-only Log, Settings and pause/end controls in one row, compact connection indicator, dice in the bottom band, no overlap at any breakpoint.

### Modified Capabilities
- `board-dice`: "Dice tray readout" changes from a paper-card tray with a dice icon to a borderless 3D dice illustration, docked and centered (turn focus).

## Impact

- Code: `apps/client/src/scene/Scene.tsx` (OrbitControls config), new `scene/useGestures.ts`; `hud/Hud.tsx`, `hud/GamePause.tsx`, `hud/ViewControls.tsx`, `hud/dice/DiceTray.tsx`, `hud/TurnFocus.tsx`, `settings/SettingsButton.tsx`, `store/dock.ts` (`hudLayout`); i18n `en`/`es` (new aria labels/tooltips); a dice illustration asset.
- Depends on unarchived change `cursor-affordances-and-hud-layout` (bottom-left cluster, `hud-bottom-controls`). This change supersedes its control placement; apply or archive it first, or reconcile its `hud-bottom-controls` spec when archiving.
- No engine, server or protocol changes.
