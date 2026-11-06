## 1. Size and area

- [x] 1.1 Add `DICE_SCALE = 1.5` in `scene/dice/area.ts` (world die edge 0.45 = `DIE_EDGE` × scale); keep `DIE_EDGE` 0.30 as the model contract
- [x] 1.2 Rewrite `scene/dice/area.ts`: local `DICE_AREA` unchanged, centered on the origin and scaled by `DICE_SCALE`; `areaCorners()` returns world corners; remove `diceAreaPlacement`, `AreaPlacement`
- [x] 1.3 Rewrite `test/scene/dice/area.test.ts`: area stays within the center hex and its ring (no coast hex, no harbor marker), and every corner at floor and die height projects inside the view at 16:9 and 9:16 for default, max-turn and min-distance cameras
- [x] 1.4 Confirm `simulate.test.ts` still passes unchanged (simulation runs in local units)

## 2. Camera

- [x] 2.1 Remove `fitDistanceWithDice` and `DICE_MARGIN` from `scene/useFitCamera.ts`; use `fitDistance`; update any tests that used it

## 3. Visibility lifecycle

- [x] 3.1 Add `reason: "update" | "snapshot" | "reduced"` to `useDiceThrow` in `game/diceThrow.ts` (keep `mode`); tray unchanged
- [x] 3.2 In `DiceController`: add phases `hidden | throwing | resting | fading`, `HOLD_MS = 5000`, `FADE_MS = 500`, `visible` and `opacity` getters; start hidden; snapshot → hidden + settled; reduced/fallback → resting now; throw end → resting; hold end → fading (or hidden when no fade); fade end → hidden; new roll resets; `playing` true until hidden
- [x] 3.3 Remove `restingValues`/previous-roll resting display and the `previous` input; replace `REST_POSES` with poses near the area center sized for the new edge
- [x] 3.4 Update `test/scene/dice/controller.test.ts`: hidden at start and before a roll; snapshot hidden with settled index; throw → rest → 5 s hold → 0.5 s fade → hidden; reduced motion hides at 5 s with no fade; new roll during fade resets opacity to 1; no rethrow on later updates

## 4. Board rendering

- [x] 4.1 `BoardDice.tsx`: drop the mat and aspect placement; group at `[0, floorY + 0.01, 0]`; set die groups' `visible` and opacity from the controller each frame (clone materials once per die, `transparent` only while fading); disable raycast on the die groups
- [x] 4.2 `Scene.tsx`: pass the land-surface height (0) as `floorY` instead of `tableY`; update the header comment
- [x] 4.3 Update `board-dice` comments that mention the side mat (BoardDice, area, controller, useFitCamera)

## 5. Verify

- [x] 5.1 `pnpm` typecheck, lint and client tests pass
- [ ] 5.2 Run the app: roll in flat and raised relief, 16:9 and 9:16, default/turned/zoomed camera; dice land in the middle, bigger, fade 5 s after rest; reconnect mid-turn shows no board dice; reduced motion hides without fade; robber pick under a die works
