## Context

- Dice values come from the server's seeded RNG (AGENTS.md §13.14). The client learns them from `diceRolled` / `orderRolled` log entries via `latestRoll(view.log)`. The client never decides a value.
- Today the dice are CSS 3D cubes (`hud/dice/Die3d.tsx`) inside the HUD tray (`hud/dice/DiceTray.tsx`). The tray is also the roll button. `useDiceThrow` decides whether to animate: only for a new roll that arrived as an incremental update, never for a snapshot, never under reduced motion, never twice for one roll. The unarchived `dice-tray-3d` change rejected WebGL/physics at the time.
- The board is one R3F `<Canvas shadows>` (`App.tsx` → `scene/Scene.tsx`). Its coordinates are in hex-circumradius units, Y-up, with the board plane at y = 0. Themed models load by asset key through `theme/` with procedural fallbacks.
- `Dice.obj` (Blender 2.76 export, 2186 vertices, 2184 faces, no UVs) is a rounded cube with extents of about ±1.27 and two materials from `Dice.mtl`: `Red` (body, Kd 0.64 0.017 0.019) and `White` (pips, Kd 0.8). Counting `White` faces per side (36 per pip) gives the face map +Y=1, +Z=2, +X=3, −X=4, −Z=5, −Y=6. Opposite faces sum to 7.
- No physics library is installed. The client has three 0.180, R3F 9 and drei 10.

## Goals / Non-Goals

**Goals:**
- Real 3D dice thrown with rigid-body physics on the table, ending on the server's values every time.
- The same tumble for every player on the same browser engine, and always the correct values on every engine.
- No physics or animation for snapshots or under reduced motion.
- Zero cost on the start screen; the game keeps working with no die model file.
- Pure, unit-testable simulation and face logic.

**Non-Goals:**
- Players flicking or dragging the dice. The throw stays a button press that sends `rollDice` / `rollForOrder`.
- Dice colliding with board pieces, tiles or the robber.
- Dice sounds (possible follow-up with the existing sound settings).
- Any server, protocol or engine change.

## Decisions

### 1. Simulate the whole throw first, then play it back
When a roll should animate, the client runs the simulation headless at a fixed step (1/120 s) until both dice sleep or 4 s of simulated time pass. It records the position and orientation of each die per step, then plays the recording back against the wall clock with interpolation.
- Why: the landing face must be known before the first frame is shown, so the visual can be remapped (decision 2). The recording also makes playback independent of frame rate, so a slow device shows the same throw, just less smoothly.
- Alternative: run the physics live in `useFrame` and correct at the end. That needs a visible snap or a steered tumble, and the result depends on frame timing. Rejected.
- Cost: about 480 steps × 2 bodies with a few colliders, a few milliseconds. The recording is about 7 KB of floats.

### 2. Face remap by a cube symmetry
Each physics body is a box. The visual die mesh is a child of the body with a fixed extra rotation R. After the simulation, the client finds which local axis of the body points up at rest (the axis with the largest world-Y component). R is chosen from the 24 rotations of the cube so that it carries the model's axis for the rolled value onto that body axis. Because R is a symmetry of the collision box, the physics is identical; only which pips are painted on which side changes. R is fixed for the whole playback, so the die never visibly turns at the end.
- R choice: the first rotation in a fixed table of the 24 that maps the value axis onto the up axis. This keeps it deterministic and testable.
- Alternative: retry seeds until the natural landing matches. That needs 36× more simulation on average and gives no guarantee. Rejected.

### 3. Seeded throw shared by everyone
The initial pose, linear velocity and angular velocity of each die come from a small PRNG (mulberry32) seeded with a hash of the room code, the roll's log index and the die index. Every client derives the same throw without new protocol fields.
- cannon-es is plain JavaScript, so it is deterministic on one engine. Engines may differ in the last bits of `Math.sin`/`Math.cos`, so two browsers may show slightly different tumbles. The values are still correct everywhere because each client remaps its own landing (decision 2).
- Alternative: the server sends a throw seed. That changes the protocol for no gain, since the room code and log index are already shared. Rejected.

### 4. cannon-es, loaded lazily
- Picked `cannon-es`: pure JavaScript, no WASM to fetch or initialize, runs in Node for tests, about 40 KB gzipped, enough for boxes on a plane with walls.
- Alternatives: `@react-three/rapier` / Rapier (WASM, about 600 KB, async init, harder to run in unit tests) and a hand-written box integrator (fragile contacts). Rejected.
- The dice component and cannon-es load with `React.lazy` / dynamic `import()` when the game view mounts. While loading, or if loading fails, the dice show at rest (decision 7).

### 5. Dice area on the table, beside the island
- The dice land in a rectangular dice area on the table plane at the front-right of the island (toward the viewer's bottom-right, matching the HUD tray's corner). It sits outside the land hexes and harbor markers and inside the default camera framing; `useFitCamera` includes it.
- The colliders are a floor at the table height plus four invisible walls around the area, with friction and restitution tuned for two or three bounces. The dice are thrown from just outside one edge, angled inward and down.
- Die size: an edge of 0.30 units (about a number token's diameter), so they read clearly without hiding the board.
- Alternative: throwing over the island. That needs colliders for every piece and can cover the board while players read it. Rejected.

### 6. Die model through the theme
- New model key `dice.die`. Unlike the pieces, the die's origin is its center (it rotates freely), and the converted GLB is scaled so its edge is 0.30 units.
- `tools/obj-to-glb.mjs` parses the OBJ and MTL and writes `apps/client/public/themes/diorama/models/die.glb`: welded indexed geometry with normals, the two materials named `Red` and `White`, meshopt-compressed, deterministic.
- The value-to-axis map is a constant in the client (`DIE_FACE_AXES`). The conversion verifies it from the pip counts and fails if the source no longer matches.
- Procedural fallback: a rounded box (drei `RoundedBox`) in the same red with white pip discs placed on the same axes, so remapping works the same on both.
- Sources move to `docs/art/sources/dice/` with a `SOURCE.md` (author, URL, license), as for the pieces.

### 7. When to animate (reuses `useDiceThrow`)
- `useDiceThrow` keeps deciding animate vs static and moves to a shared place used by both the tray and the 3D dice.
- Animate: run decisions 1–3 and play back.
- Static (snapshot, reduced motion, physics not loaded, simulation failed): place both dice in the rest slots of the dice area with R chosen so the value faces up and a fixed small yaw.
- Before any roll in the current turn, the dice rest in their slots showing the previous roll if there is one, otherwise 1 and 1 (as the CSS dice did).

### 8. Failure handling
- If after 4 s either die is not asleep, or its up axis is more than 15° from vertical (leaning on a wall or the other die), the client retries the simulation with the attempt number mixed into the seed, up to 4 attempts. After that it uses the static display. The values are correct in every path.

### 9. Settle signal and the tray
- A small store (`store/dice.ts`) holds the roll index whose dice have settled. The 3D dice set it when playback ends (or right away when static).
- `DiceTray` reads it to announce "Rolled 3 and 4, total 7" and to call `onSettled`.
- The your-turn focus dims the whole screen. It used to stay open while the CSS dice tumbled at its center; now the throw happens on the board, so the focus closes as soon as the viewer's own roll arrives (`useTurnFocus` drops its linger) and the tray no longer closes it on settle. It no longer renders `Die3d`; it shows the total (7 in the warning color) and keeps the button, its accessible names, its highlight and its placement.
- The game does not wait on the dice: legal moves and other UI update when the state arrives, as today.

## Risks / Trade-offs

- [Floating-point differences between browser engines give slightly different tumbles] → Values are still correct (per-client remap). The spec only requires an identical throw on the same engine.
- [Dice end leaning or still moving] → Retries with new seeds, then the static display (decision 8). Unit tests run every value pair over many seeds and assert they settle.
- [Physics cost on low-end phones] → The simulation runs once per roll, about 480 steps, off the render loop. Playback is plain interpolation.
- [Bundle size] → cannon-es is lazy-loaded with the dice; the start screen does not load it.
- [Unknown license of `Dice.obj`] → The licensing guard blocks shipping the GLB until `SOURCE.md` records an allowed license. Until then the theme does not map `dice.die` and the procedural die is used.
- [Dice area cramping the board on narrow phones] → The camera fit includes the dice area. At 9:16 it moves below the island rather than to the side (tested at both aspects).
- [CSS dice tests in `dice-tray-3d`] → Updated to the readout; `Die3d` tests removed with the component.

## Migration Plan

Client-only. Ship behind no flag: the dice fall back to the static display if anything fails. Rollback is reverting the client build. No stored data changes.

## Open Questions

- Author and license of `Dice.obj` / `Dice.mtl` (the owner needs to provide them). Until then the procedural die is used.
