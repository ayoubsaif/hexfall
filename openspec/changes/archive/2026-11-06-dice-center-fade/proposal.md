## Why

The board dice land on a small mat beside the island at the front-right. When the camera is turned or zoomed in, or on a narrow screen, that corner is easy to miss, and the dice are small (0.30 units), so players often do not see the throw. Throwing the dice in the middle of the island, a little bigger, makes every roll visible from any camera position; hiding them a few seconds after they rest keeps them from covering the board.

## What Changes

- The dice are thrown onto the middle of the island instead of a mat beside it. The physics floor sits on the land surface at the board center; the side mat is removed.
- The dice are bigger: edge 0.45 hex-circumradius units (was 0.30), with pips scaled to match (the dice group is scaled 1.5×). The throw area grows with them.
- The dice are only shown for a roll: hidden before the first roll of a turn (no more resting dice showing the previous roll), visible during the throw, held at rest for 5 seconds, then faded out over 0.5 s and hidden.
- Snapshot rolls (join, resume, reconnect) no longer show dice on the board; the tray total still shows the roll. Under reduced motion the dice appear at rest for 5 s and then disappear without a fade.
- A new roll while dice are still showing or fading restarts the cycle at once with the new throw.
- The default camera fit no longer backs off to keep a side dice area in view (the center is always in view).
- Still unchanged: dice land on the server's values, shared seeded throw, retry rules, tray readout and announce-on-rest, physics loaded on demand.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `board-dice`: dice area moves to the island center, die edge grows to 0.45, dice are hidden before a roll and disappear 5 s after resting (fade), snapshot rolls show no board dice.

## Impact

- Client only: `apps/client/src/scene/dice/` (`area.ts`, `BoardDice.tsx`, `controller.ts`), `apps/client/src/game/diceThrow.ts` (throw reason), `apps/client/src/scene/useFitCamera.ts` (drop dice back-off), `apps/client/src/scene/Scene.tsx` (floor height passed to dice).
- Tests: `test/scene/dice/area.test.ts`, `controller.test.ts`, `simulate.test.ts` re-run unchanged.
- No server, engine, protocol or dependency changes.
