## 1. Input kind state

- [x] 1.1 Add `inputKind` + `setInputKind` to `apps/client/src/store/view.ts`, default from `matchMedia("(pointer: coarse)")`
- [x] 1.2 Report touch/mouse from pointer events and touchpad/mouse from wheel classification in `scene/useGestures.ts` (sticky, only on change)
- [x] 1.3 Unit tests for detection (touch tap, touchpad wheel, mouse wheel, initial coarse default)

## 2. Top container

- [x] 2.1 Rework `PlayerPanels.tsx`: `flex-nowrap`, flexible truncating panels, badges moved into the head row, stable height
- [x] 2.2 Rework top block in `Hud.tsx`: one wrapper with panels then `ViewControls`; remove `short:absolute top-right` placement
- [x] 2.3 HUD tests: single row with all badges, controls directly after container, short viewport

## 3. View controls themes

- [x] 3.1 Make mouse theme thinner (bar ≤ 36 px, slimmer slider/buttons) in `ViewControls.tsx`
- [x] 3.2 Add Google Maps theme for `touch`/`touchpad` (stacked joined zoom pair, round preset buttons, no slider/percent, blue active preset), 40 px hit areas
- [x] 3.3 Keep test ids and handlers; select theme from `inputKind`
- [x] 3.4 Component tests for both themes and zoom/preset behavior

## 4. Verify

- [x] 4.1 Run client typecheck, lint and tests
- [ ] 4.2 Manual check at desktop, 390×844 touch and short landscape; confirm no overlap with log button, offers and hand
