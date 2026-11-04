## 1. Die cube

- [x] 1.1 Add the dice tokens to `@theme` in `style.css`: `die`, `die-rim`, `pip`, `pip-red`, plus the `dice-tumble` (800 ms) and `dice-bounce` (900 ms) keyframes. The bounce uses the `translate` property, not `transform`. Verify: `vp build` passes, and the keyframes are inside the `.hud` reduced-motion rule.
- [x] 1.2 Build `hud/dice/Die3d.tsx`:
  - six `preserve-3d` faces sized by `--die`; opposite faces sum to 7;
  - pips on a 3 × 3 grid, with 1 and 4 red and the 1 pip enlarged;
  - an inner plate behind the faces, and a radial-gradient floor shadow (no `filter`).

  Credit the reference pen in a source comment. Verify: an RTL test renders each value and checks that the front face shows that value's pip count and colors (red for 1 and 4).
- [x] 1.3 Add `restTransform(v)` and the `FACE_ROTATION` table (design decision 2). Verify: a unit test, using three.js `Euler`/`Vector3` or plain matrices, checks that for v = 1…6 the rotation turns face v's normal to +Z before the fixed tilt.

## 2. Throw and tray

- [x] 2.1 Add `useDiceThrow(roll)`. It returns `animate` only when the roll's log index changed, the store `source` is `"update"` and reduced motion is off. Otherwise it returns `static`. It re-keys the dice on each new roll. Verify with unit tests:
  - an update animates;
  - a snapshot doesn't;
  - mocked reduced motion doesn't;
  - the same index on re-render doesn't replay.
- [x] 2.2 Build `hud/dice/DiceTray.tsx`, a single `<button>`:
  - its name is "Roll dice" / "Roll for order" from `controlsOf()`; otherwise it is disabled and named after the last roll;
  - a static highlight while legal; `act()` on click or Enter; disabled while in flight;
  - a polite live region with "Rolled a and b, total n", updated on `animationend` (immediately when static);
  - a total of 7 in `text-bad`.

  Verify with RTL tests:
  - clicking sends `rollDice` once, and a second click while in flight sends nothing;
  - with `rollForOrder` legal the name is "Roll for order" and a click sends `rollForOrder`;
  - with no legal roll the button is disabled;
  - a snapshot roll shows the total immediately.
- [x] 2.3 Remove the `Dice` component, the `Die` pip grid and the Roll dice / Roll for order buttons from `TurnBar.tsx`. Move the existing roll tests in `test/hud/game-ui-panels.test.tsx` to the tray. Verify: those tests pass against `DiceTray`, and a new test asserts that the turn bar has no roll button.

## 3. Placement

- [x] 3.1 Mount `DiceTray` in `GameHud`, positioned from `useDockStore` (`store/dock.ts`), `pointer-events-auto` and with no ancestor `filter` or `overflow`. Set `--die` to 44 px, or 36 px on `max-sm` and `short`. Verify: a unit test sets the dock in the store and checks the tray's inline position.
- [x] 3.2 (Revised by the owner: the board stays a full-screen background, so no inset is reserved for the dice.) Verify: screenshots at 360 × 740, 768 × 1024, 900 × 500 and 1440 × 900 (injected game view with legal targets shown) show the tray in the free area's bottom-right corner, covering no panel, log, stack or corner control, and with no horizontal scroll.

## 4. Verification

- [x] 4.1 Motion check in the running client. Roll with normal motion and measure via `document.getAnimations()`: the tumble and bounce are each ≤ 1.2 s, one iteration each, and nothing in the HUD loops afterwards. Then force the reduced-motion rules and `matchMedia`: no dice animation runs and the result shows at once. A resume (reload mid-turn) shows the dice without a throw. Share a GIF of a throw with the owner.
- [ ] 4.2 WebKit check: render the tray in Playwright WebKit (or Safari) and confirm the cubes keep their depth (they are not flattened). Verify: a screenshot is attached to the owner review.
- [x] 4.3 Run `pnpm run test`, `vp lint`, `node tools/check-engine.mjs`, `node tools/check-assets.mjs` and `vp build` in `apps/client`. Verify: all pass, apart from the `docs/art/minimal/build.mjs` format failure already recorded in CHECKPOINT.md.
- [ ] 4.4 Owner review: desktop and phone screenshots of the tray before the roll (highlighted), mid-throw and settled on a 7. Verify: the owner approves, or their feedback is applied.
- [x] 4.5 Update `CHECKPOINT.md` with a `dice-tray-3d` section: where the dice live, the tokens, the motion exception, and the archive order (`client-3d` and `hud-tailwind-cards` first). Verify: the section exists and names all four.
