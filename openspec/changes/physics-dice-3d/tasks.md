## 1. Die asset

- [x] 1.1 Move `Dice.obj` and `Dice.mtl` to `docs/art/sources/dice/` and add `SOURCE.md` (author, URL, license; mark license unknown until the owner provides it)
- [x] 1.2 Write `tools/obj-to-glb.mjs`: parse OBJ/MTL, check the pip face map (+Y=1, +Z=2, +X=3, −X=4, −Z=5, −Y=6), center, scale to a 0.30 edge, weld with normals, keep `Red`/`White` materials, meshopt-compress, write `die.glb` deterministically; add `pnpm run models:dice`
- [x] 1.3 Tests for the conversion: bounding box and edge, materials, determinism, face-map failure on a tampered source
- [x] 1.4 Add the `dice.die` model key to `theme/keys.ts` (key set and kind), the manifest schema and `tools/check-assets.mjs`; map it in the diorama `theme.json` only once `SOURCE.md` names an allowed license
- [x] 1.5 Procedural die fallback: rounded red box with white pips on the contract axes, same size and origin; test that fallback and model show the same value up

## 2. Simulation core (pure, no React)

- [x] 2.1 Add `cannon-es` to `apps/client`
- [x] 2.2 `scene/dice/faces.ts`: `DIE_FACE_AXES`, the 24 cube rotations, `upAxis(quaternion)` and `remapFor(value, upAxis)` (first rotation carrying the value axis onto the up axis); unit tests for every value × up axis
- [x] 2.3 `scene/dice/seed.ts`: hash of room code, roll index, die index and attempt → mulberry32 throw parameters (pose, velocity, spin); tests for stability
- [x] 2.4 `scene/dice/simulate.ts`: world with floor and four walls for the dice area, two box bodies, fixed 1/120 s step, sleep detection, 4 s cap; returns a recording, the rest up axes and whether it settled flat (≤15°)
- [x] 2.5 `throwDice(room, index, values)`: up to 4 attempts, then remap per die, or `null` for the static display
- [x] 2.6 Tests: all 36 value pairs over many seeds land on the server values; same inputs give identical recordings; an unsettled attempt triggers a retry; total throw ≤ 4 s

## 3. Board dice component

- [x] 3.1 Move `useDiceThrow` to a shared place (for example `game/diceThrow.ts`) used by the tray and the board dice; keep its tests
- [x] 3.2 Add `store/dice.ts` holding the settled roll index
- [x] 3.3 `scene/dice/BoardDice.tsx`: dice area placement (front-right of the island, below at 9:16), playback of the recording with interpolation against the clock, model as a child with the fixed remap rotation, shadows; sets the settled index at the end
- [x] 3.4 Static display: rest slots with value up and a fixed yaw for snapshots, reduced motion, loading, load failure and failed simulation; previous roll or 1 and 1 before the turn's roll
- [x] 3.5 Mount `BoardDice` from `scene/Scene.tsx`; it lazy-loads the physics (`import("./simulate.ts")`, cannon-es) on mount and shows the dice at rest until then
- [x] 3.6 Include the dice area in `useFitCamera`; check 16:9 and 9:16 framing tests
- [x] 3.7 Component tests: snapshot roll shows static values, update roll throws once, reduced motion is static, no re-throw on later updates in the same turn, model-to-body rotation never changes during playback

## 4. HUD tray

- [x] 4.1 `DiceTray`: drop `Die3d`, show the total (7 in the warning color, nothing before the turn's roll); keep button, names, highlight, send-once and placement
- [ ] 4.2 Announce "Rolled X and Y, total Z" and run `onSettled` when the settled index reaches the roll; close the your-turn focus as soon as the viewer's own roll arrives (drop the linger in `useTurnFocus`)
- [ ] 4.3 Remove `hud/dice/Die3d.tsx` and its tests; update the `DiceTray` tests and the i18n strings if any change (en/es)

## 5. Verification

- [ ] 5.1 Check that the production build puts cannon-es in its own chunk not loaded by the start screen
- [ ] 5.2 Run client tests, lint, format and `pnpm run check` (asset budget)
- [ ] 5.3 Try it in the running app: rolls during play and for order, two browser tabs show the same throw, reload mid-turn shows static dice, reduced motion shows static dice
- [ ] 5.4 Update the README (dice section, `models:dice`) and note in `dice-tray-3d` that its CSS dice are superseded

## Resume notes (checkpoint 2026-11-06)

- Done: sections 1–3, 4.1. `useTurnFocus` now closes the focus at once on the viewer's roll (4.2 code done).
- Next: update tests that still expect the old CSS dice / focus linger:
  `test/hud/DiceTray.test.tsx` (centered mode closes at roll arrival; no `.animate-dice-tumble`),
  `test/hud/TurnFocus.test.tsx` (`FOCUS_LINGER_MS` removed: expect "closed" right after the roll),
  `test/hud/game-ui-panels.test.tsx` (~line 184, settle via `useDiceStore`/timeout).
  Add `resetDice()` to `resetAll()` in `test/hud/helpers.tsx`.
- Then 4.3 (delete `hud/dice/Die3d.tsx` + `test/hud/Die3d.test.tsx`), section 5.
