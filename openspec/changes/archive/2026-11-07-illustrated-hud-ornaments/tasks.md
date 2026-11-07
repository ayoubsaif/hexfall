## 1. Art

- [x] 1.1 Generate the brass filigree corner (top-left, flat key-color background) and the grey carved-stone corner; key out the background
- [x] 1.2 Export four orientations each to `public/ui/corners/{brass,stone}-{tl,tr,bl,br}.webp`
- [x] 1.3 Generate one 4×4 icon sheet in the avatar style; crop, key out, export 14 icons at 128 px over the existing files
- [x] 1.4 Review corners and icons at real size on paper and leather backgrounds

## 2. Style

- [x] 2.1 Replace `.frame` with image corners and add `.frame-brass` in `style.css`; hide corners on controls under 36 px
- [x] 2.2 Make Dialog, Card, Sheet, Tooltip, Tabs, Input and Button variants square; `.hud-leather` radius 0
- [x] 2.3 Dialog uses `frame-brass`; secondary and cancel buttons and cards use `frame`

## 3. Tests and check

- [x] 3.1 Update tests that assert the old classes; add a test that corner and icon files exist
- [x] 3.2 Run typecheck and all tests; check dialogs, cards and the start screen in the browser
