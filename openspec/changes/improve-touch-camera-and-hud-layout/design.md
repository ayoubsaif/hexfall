## Context

- `scene/Scene.tsx` mounts drei `OrbitControls` with defaults: left-drag orbit, right-drag pan, wheel zoom; touch: one finger orbit, two fingers dolly+pan. Touchpads have no right button, so pan is unreachable; two-finger scroll arrives as `wheel` events and zooms instead. The canvas has no `touch-action` guard, so the browser may scroll/zoom the page.
- `hud/dice/DiceTray.tsx` draws a `paper` card (rounded, shadow, ring) around a lucide `Dices` icon plus total. `TurnFocus` dims the screen and the same element is FLIP-moved to the center.
- `hud/Hud.tsx` puts Settings, ViewControls, HostGameMenu and ConnectionBadge in a wrapping bottom-left corner; Log is a top-left text button; the dice tray and FABs dock bottom-right above the hand. The annotated screenshot shows: Settings above the pause button, Log as text at top, connection pill on its own row, dice as a large card bottom-right. The user wants one compact bottom band.
- Sibling unarchived change `cursor-affordances-and-hud-layout` defines the current corner layout.

## Goals / Non-Goals

**Goals:**
- One gesture map that works on mouse, touchpad, touchscreen, with no page scroll/zoom leakage.
- Borderless 3D dice illustration, docked and centered.
- All HUD controls fit one bottom band at 360x640, 667x375, tablet and desktop, no overlaps.
- Repeatable touch/touchpad test checklist.

**Non-Goals:**
- Rotating the camera by twist gesture; custom inertia; changing camera limits or presets.
- Changing dice physics or roll results (`board-dice` throw behavior is untouched).
- Engine/server changes.

## Decisions

1. **Touchpad pan via wheel interception, not a mode toggle.** Add a small `useGestures` hook that listens for `wheel` on the canvas element (`passive: false`). `ctrlKey === true` (pinch on touchpads, also ctrl+wheel on mouse) keeps dolly. `ctrlKey === false` and the event looks like a touchpad (`deltaMode === 0` and non-integer or `deltaX !== 0` or small `|deltaY|`) pans the camera target in the screen plane, clamped to the existing bounds; otherwise (notched mouse wheel) it dollies as today. `preventDefault()` always, to stop page scroll. OrbitControls `enableZoom` is turned off for the wheel path and dolly is driven by the hook so there is a single owner.
   *Alternatives:* a "pan mode" toggle button (extra UI, slow); mapping two-finger scroll to orbit (conflicts with expectation of "right click" pan the user asked for); using `shift+drag` (undiscoverable). Heuristic detection is imperfect, so a settings toggle "Touchpad gestures: auto / mouse wheel zooms" overrides it (default auto).
2. **Touchscreen map via OrbitControls `touches`.** `ONE: ROTATE`, `TWO: DOLLY_PAN` (drei/three default, made explicit and tested). Set `touch-action: none` on the canvas so the browser never claims the gesture; HUD overlays keep default touch-action so panels still scroll.
3. **Tap vs drag.** Camera drags already set `setCameraDragging`. Raise the move threshold to 6 px for touch (coarse pointer) before a gesture counts as a drag, so tapping targets/pieces with a slightly moving finger still selects. Picking ignores pointer-up when a multi-touch gesture was active.
4. **Dice illustration as a pre-rendered transparent asset, not a card.** Reuse the board dice look (white, black pips) as a transparent PNG/WebP sprite pair (or inline SVG of an isometric die pair) with a soft drop-shadow via CSS `filter: drop-shadow`, no `paper` background, border or ring. The "ready" highlight becomes a glow/pulse-free outline of the illustration (`filter` + a visible focus ring on the button, which stays a real `<button>` for a11y). Total digits render beside it with a text-shadow for contrast on water. Centered focus state scales the same element (existing FLIP move).
   *Alternative:* a live second R3F canvas for a rotating die — heavier, a second WebGL context on phones; rejected.
5. **Bottom band layout.** Replace the wrapping bottom-left cluster with a single flex row `[Settings][Pause/End][Log][Connection dot+ping]` plus `ViewControls`; the dice tray anchors in the same band at the right end, left of the FABs. `hudLayout()` in `store/dock.ts` stops reserving the corner as a column on portrait; instead the band is one row with `--band-h`. On very narrow widths the row scrolls never; it drops ViewControls into a single "view" menu button (icon) before wrapping.
6. **Connection indicator.** Keep the `role="status"` live region and test ids (`connection-status`, `connection-ping`) but the visible label becomes a dot plus ping; the status text moves into `sr-only` plus a tooltip. Errors (reconnecting, closed, version mismatch) expand the text so state is never color-only.
7. **Log button icon-only** with `aria-label`, tooltip; the drawer is unchanged. Moves from top-left to the band; the top edge keeps only the player panels.
8. **Spec relation.** `hud-compact-controls` is a new capability that supersedes the placement requirements of the unarchived `hud-bottom-controls` (top edge holds Log; bottom-left corner). Reconcile at archive time.

## Risks / Trade-offs

- [Touchpad vs wheel mouse detection wrong] → settings override, plus a unit test table of wheel event fixtures (Mac trackpad, Windows precision touchpad, Logitech notched wheel).
- [`touch-action: none` blocks page gestures such as browser back-swipe] → acceptable on a full-screen game canvas; HUD panels excluded.
- [Preventing wheel default is global to canvas] → limited to canvas element only, so drawers and dialogs still scroll.
- [Transparent dice sprite lacks contrast on bright water] → drop-shadow and digit text-shadow; check against sea and sand backgrounds.
- [Crowded bottom band on 360px width] → icon-only controls at 40–44 px, 8 px gaps (about 5 items fit with the dice), overflow-to-menu fallback for ViewControls, covered by a viewport matrix test.
- [Two overlapping unarchived changes] → noted in proposal; archive order matters.

## Open Questions

- Should the touchpad override live in Settings or only auto-detect? (Plan: Settings, default auto.)
- Is the die sprite generated from the board dice model (render script) or hand-drawn SVG? (Plan: render from the existing die geometry once, commit the asset.)
