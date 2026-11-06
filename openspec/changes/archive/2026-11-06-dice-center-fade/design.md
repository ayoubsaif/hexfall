## Context

`physics-dice-3d` added two cannon-es dice thrown onto a green mat beside the island (`scene/dice/area.ts` places the area by aspect ratio; `useFitCamera` backs the camera off so the area stays in view). `DiceController` (pure, clock-free) holds the frame: a static resting pose before/after rolls, or a recorded throw played back by `tick()`. `BoardDice` copies poses onto two `<Asset assetKey="dice.die">` groups and calls `setDiceSettled` when a throw ends, which drives the tray's announcement.

Problems: the side mat is off the camera's focus and leaves the view when the player orbits or zooms; the dice are small; resting dice stay on the table forever.

## Goals / Non-Goals

**Goals:**
- Throw lands on the island center, visible from any allowed camera angle and zoom.
- Dice 1.5× bigger (edge 0.45).
- Dice disappear 5 s after resting with a 0.5 s fade; hidden when no roll is being shown.
- Keep every existing guarantee: server values, no end snap, shared deterministic throw, retries, announce on rest, lazy physics.

**Non-Goals:**
- Dice colliding with tiles, pieces or the robber.
- Moving the dice off the board as an animation (fade chosen instead, see decision 4).
- Any tray, server or engine change.

## Decisions

1. **Throw area centered on the origin, floor on the land surface.** `area.ts` drops `diceAreaPlacement`/`areaCorners`; the local area narrows to `DICE_AREA = { halfX: 1.1, halfZ: 0.8 }` (was 1.3 × 0.8) and is drawn centered at world (0, 0) with no yaw, scaled by `DICE_SCALE` (decision 3), so in world units it spans 1.65 × 1.2 half-sizes. Every corner then lies inside the center hex or a first-ring hex (at 1.3 the corners reached coast hexes), so the dice never reach the coast. The floor is the top of the land tiles: `BoardDice` receives `floorY = 0` (land top for both flat and raised relief, the sea is what is lowered) plus a small lift (0.01) so shadows do not z-fight with tile tops. The walls stay invisible physics planes. The mat mesh is removed. *Alternative:* keep the area beside the island and only enlarge it — rejected, it still leaves the view on orbit/zoom, which is the user's complaint.

2. **Throw parameters unchanged.** Because the whole dice group is scaled (decision 3), the simulation runs in the same local units as before: `throwParams`, retries, `MAX_TILT`, `MAX_ATTEMPTS` and the 4 s cap are untouched and recordings stay deterministic. Scaling distances but not time makes the throw read slightly floatier (gravity looks 1.5× weaker); acceptable.

3. **Scale the board-dice group by `DICE_SCALE = 1.5` instead of changing `DIE_EDGE`.** `DIE_EDGE` (0.30) is the model coordinate contract: the GLB converter (`tools/obj-to-glb.mjs`) bakes the die at 0.30, the fallback and pip math use it, and the physics box matches it. Scaling the group that holds the physics-space dice gives a world edge of 0.45 for both the GLB and the fallback with one constant and no asset rebuild. *Alternative:* `DIE_EDGE = 0.45` — rejected: needs regenerating the GLB, retuning throw speeds/heights and re-checking settle rates.

4. **Visibility lifecycle in the controller, fade in `BoardDice`.** `DiceController` gains a `visibility` phase computed from the clock: `hidden` → `throwing` → `resting` (5 s, `HOLD_MS = 5000`) → `fading` (`FADE_MS = 500`) → `hidden`. It exposes `opacity` (1 until fade, then linear to 0) and `visible`. `tick(now)` keeps running while resting/fading so `useFrame` keeps invalidating, then stops. Rules:
   - Animated throw: `throwing` until rest (settled event fires as today), then `resting` from that moment.
   - Static roll under reduced motion: `resting` immediately for 5 s, then `hidden` with no fade (opacity jumps 1 → 0).
   - Static roll from a snapshot (join/resume): `hidden`, settled fires immediately so the tray still announces.
   - Before any roll in the turn / on mount with no current roll: `hidden`. The "previous roll at rest" display is removed.
   - New roll while resting/fading: restarts from the new roll's phase; opacity resets to 1.
   `BoardDice` sets each die group's `visible` and, while fading, traverses the die meshes once to clone their materials (per die instance) with `transparent = true` and writes `opacity` each frame; on reset it restores opacity 1 and `transparent = false` to avoid sorting cost. *Alternative:* slide the dice off the board — rejected: needs a second path that crosses tiles/pieces and reads as noise; fade is simpler and is what the user listed as acceptable. *Alternative:* shrink to zero — cheaper (no material clones) but looks less like "hide"; keep as fallback if material cloning misbehaves with the themed asset.

   To tell snapshot from reduced motion, `useDiceThrow` returns a `reason` (`"snapshot" | "reduced" | "update"`) alongside `mode`; the tray keeps using `mode` only.

5. **Camera fit stops backing off for dice.** `fitDistanceWithDice` and `DICE_MARGIN` are removed; `useFitCamera` uses `fitDistance` again. The dice area is inside the fit circle, so it is always framed.

6. **Pieces are not obstacles.** The dice may pass visually through settlements, cities, roads or the robber near the center. Accepted: the throw is short, the dice are opaque and on top, and they vanish after 5 s. Not adding colliders keeps the "dice SHALL NOT collide with tiles, pieces or the robber" rule and keeps the simulation independent of board state (which is required for a shared throw across clients that may receive pieces at slightly different times).

## Risks / Trade-offs

- [Dice clip through pieces/robber at the center] → short duration, hide after 5 s; area kept to center + first ring.
- [Dice cover the center hexes for ~5–9 s, blocking robber/building picks there] → the dice do not take pointer events (`raycast` disabled on the die groups), so picks underneath still work.
- [Cloned transparent materials cost per fade] → only 2 dice, clones made once per mount and reused; `transparent` turned off when opaque.
- [Players who joined mid-turn see no board dice] → the tray total and accessible text still show the roll; matches "snapshot shows no animation".
- [Bigger area changes recordings vs. the old area] → only within a release; all clients on the same build still match.
