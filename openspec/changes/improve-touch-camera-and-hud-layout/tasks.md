## 1. Camera gestures

- [x] 1.1 Add `scene/useGestures.ts`: canvas `wheel` listener (`passive: false`) with touchpad detection, pan (no ctrl), pinch zoom (ctrl), notched-wheel zoom; clamp to camera limits
- [x] 1.2 Unit-test the wheel classifier with fixtures (Mac trackpad, Windows precision touchpad, notched mouse, pinch)
- [x] 1.3 Configure `OrbitControls` in `scene/Scene.tsx`: explicit `touches` (ONE rotate, TWO dolly-pan), disable built-in wheel zoom, wire the hook, keep mouse buttons
- [x] 1.4 Set `touch-action: none` on the canvas; verify HUD panels still scroll
- [x] 1.5 Tap-vs-drag thresholds (3 px mouse, 6 px touch) and ignore selection after multi-touch in `scene/picking.ts` / `Targets.tsx`
- [x] 1.6 Settings option "Touchpad gestures: auto / mouse wheel zooms", stored on device; en/es strings
- [x] 1.7 Wheel classifier and threshold tests (pointer-event integration covered by manual matrix 4.1)

## 2. Dice illustration

- [x] 2.1 Transparent 3D dice illustration (two white dice showing the roll) as inline SVG `DiceArt`
- [x] 2.2 Rewrite `hud/dice/DiceTray.tsx` to drop the `paper` card, ring and `Dices` icon; draw the illustration with drop-shadow, total beside it with text-shadow
- [x] 2.3 Ready highlight (glow/outline of the illustration) and visible keyboard focus ring; keep `data-testid`s, aria names, announce behavior
- [x] 2.4 Center the same element during turn focus (`TurnFocus`, existing FLIP move) enlarged, still borderless; check contrast over the dimmed backdrop
- [x] 2.5 Update tests (log button, square FAB, prefs); gesture classifier tests in `test/scene/gestures.test.ts`

## 3. HUD compaction

- [x] 3.1 Make Log an icon-only round button (aria-label, tooltip) in the bottom band; remove it from the top-left; update `LogDrawer` in `hud/Hud.tsx`
- [x] 3.2 Rebuild the bottom-left cluster as one nowrap row: Settings, pause/end (`HostGameMenu`), Log, connection; share one icon-button size (40 px, 44 px coarse)
- [x] 3.3 Compact `ConnectionBadge`: dot + ping, text in `sr-only` and tooltip, expanded text for non-open states; keep test ids and live region
- [x] 3.4 Dice stay docked bottom-right beside the action buttons (existing `hudLayout`); band and dice share the bottom edge
- [ ] 3.5 Collapse `ViewControls` to a single icon menu when the band cannot fit; no wrap, no clipping
- [x] 3.6 Update i18n en/es (Log, Settings, Pause labels and tooltips)
- [ ] 3.7 Layout tests/screenshots at 1440x900, 1024x768, 390x844, 360x640, 667x375: no overlap, all controls on screen

## 4. Verification

- [ ] 4.1 Manual device matrix: precision touchpad, Mac trackpad, notched mouse, Android phone, iPhone (orbit, pan, pinch, tap select, no page scroll/zoom); record results in the change
- [x] 4.2 Run typecheck, lint and the client test suite
- [ ] 4.3 Reconcile with `cursor-affordances-and-hud-layout` (archive order / `hud-bottom-controls` supersession)

## Added by /opsx:apply
- Square style: new `.hud-square` class (0 radius, 2 px leather-brown border) applied to Settings, pause, Log, connection, view controls, FABs, status pill, player panels, offers, dice countdown.
- Leather buttons (`.hud-leather`, `.hud-leather-round`), leather title banners for dialogs/drawers, wax-seal close, gold icon set (`public/ui/icons`), resource-icon rounded cards, floating harbor chips and probability-sized number fonts, red/gold dice (HUD + board).
- Layout revision: Settings, pause and Log stay bottom-left; the connection indicator is floating text (no card) below them; the view/zoom bar (zoom out, slider, zoom in, percent, 3 presets) moved to the top-left above the player cards. Supersedes "single bottom row" and "view presets in the band" in the `hud-compact-controls` spec.
- Player cards: dark leather header strip (seat color edge, name, badges) over a parchment body.
