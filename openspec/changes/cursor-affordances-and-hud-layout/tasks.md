## 1. Canvas cursor

- [x] 1.1 Add a single cursor owner for the canvas resolving `grabbing` > `pointer` > `grab` (default when controls disabled)
- [x] 1.2 Wire `OrbitControls` `onStart`/`onEnd` in `scene/Scene.tsx` to the dragging state
- [x] 1.3 Change `scene/Targets.tsx` to report hover to the owner instead of writing `style.cursor` directly
- [x] 1.4 Unit test the cursor resolution (priority, controls disabled)

## 2. Pointer cursor on controls

- [x] 2.1 Add `cursor-pointer` / `disabled:cursor-not-allowed` to shared primitives (`tabs`, `sheet`, `dialog`, `button`, `switch`, tooltip triggers, select/menu items)
- [x] 2.2 Add scoped global CSS backstop for enabled native interactive elements in the HUD layer
- [x] 2.3 Audit one-off controls (`Fab`, `GameCard`, `MaritimePanel`, `ViewControls`, `GamePause`, `SettingsButton`, `DiceTray`, lobby/start screen) and fix gaps; keep informational-disabled as default cursor
- [x] 2.4 Confirm connection badge and player panels are not pointer

## 3. Bottom layout

- [x] 3.1 Keep the Log `SheetTrigger` at the top-left; the other controls form the bottom-left cluster in `hud/Hud.tsx`
- [x] 3.2 Move `ConnectionBadge` to the bottom corner area (compact on `max-sm`), in lobby, start screen and game
- [x] 3.3 Remove the desktop top-bar placement of the cluster and the top-right badge reservation in the `PlayerPanels` wrapper
- [x] 3.4 Update `useHudLayout`/`--corner-h` usage so offers tray, status pill and dice dock clear the new bottom cluster; adjust `hudLayout` tests if inputs change
- [x] 3.5 Update `ReloadBanner` top offset if it assumed the old top row

## 4. Verify

- [x] 4.1 Update e2e/unit tests that locate the Log button or `connection-status`
- [ ] 4.2 Manually check desktop, tablet, 360x640, 667x375 for overlap and cursors (grab, grabbing, pointer, not-allowed)
- [x] 4.3 Run client typecheck, lint and tests
