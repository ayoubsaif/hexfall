# Realistic coast / water physics checkpoint

## Resume request

Continue implementing a genuinely three-dimensional coast and physically simulated water
for High graphics quality. Preserve Classic and the lower-cost settings. The user stopped
the session explicitly to make this checkpoint and continue in a new session.

## User intent and references

- Original request: realistic sea/coast inspired by https://settlecoast.com/,
  https://bruno-simon.com/, and the supplied tropical coast image
  `/tmp/codex-clipboard-K2WYca.png`.
- User corrected the first implementation: waves should arrive at a raised sand/terrain
  coast, with small elevation and textured rocks. The first implementation was mostly
  shading on a flat plane, so do not claim that it already delivers this.
- The phrase “ball 3D physics” was clarified by the user pointing again to water physics:
  https://github.com/matsuoka-601/WebGPU-Ocean/tree/main and
  https://webgpu-ocean.netlify.app/. No separate draggable ball is requested.
- User supplied local rock material:
  `/home/as/Descargas/tmp/rock_2_4k.blend/`.
  It contains `rock_2_4k.blend` and textures:
  `rock_2_diff_4k.jpg`, `rock_2_disp_4k.png`, `rock_2_rough_4k.jpg`,
  `rock_2_nor_gl_4k.exr`.
- This is Rock 2 by Rob Tuytel, CC0: https://polyhaven.com/a/rock_2
  and https://polyhaven.com/license. Bundle optimized local maps and record provenance.

## Existing completed implementation

Commit `fe00cd3` includes the first sea implementation plus other work. Other edits were
committed concurrently by the user/another session; do not undo those commits.

- `scene/realisticWater.ts`: original analytic wave shaders, Fresnel sky/sun shading,
  seabed absorption, caustics, foam. This is NOT the referenced particle simulator.
- `scene/Water.tsx`: selects Classic/Realistic, owns texture cleanup, freezes time for
  Reduced Motion. Both modes share the baked coast distance field.
- `scene/graphicsQuality.ts`: Low/Medium/High budgets for DPR, geometry and shadows,
  Auto sampler that steps down after two sustained slow windows and a warm-up.
- `scene/AdaptiveGraphics.tsx`, `App.tsx`, `Scene.tsx`: apply quality settings.
- `settings/sections/GraphicsSection.tsx`, EN/ES translations, persisted preferences.
- Defaults: Realistic + Auto. Classic retains the previous appearance.
- Additional checkpoint fix: sampler ignores only deltas over TWO seconds (previously
  0.25); extremely slow clients below 4 FPS must still trigger fallback. Regression test
  in `test/scene/graphicsQuality.test.ts`.

## Work in progress (not wired into the scene)

Two new files are an initial draft, NOT completed or visually validated:

- `apps/client/src/scene/coastTerrain.ts`: sloped sand geometry, CPU/GLSL beach profile,
  deterministic rock placement avoiding land roads and harbor approaches.
- `apps/client/src/scene/CoastTerrain.tsx`: mesh component for lit sand and deformed
  textured rocks, async texture fallback and cleanup. Currently no caller mounts it.

The component references `/textures/coast/rock-{color,height,roughness}.webp` and a
`SOURCE.json` that DO NOT EXIST YET. The target directory is empty. An attempted sharp
conversion failed because the import `tools/node_modules/sharp/lib/index.js` does not
exist in the installed sharp version. Resolve sharp through its package exports, e.g.
execute from tools with `import sharp from 'sharp'`. Do not treat that failed command as
having generated assets. Use the user's local 4K maps as the input.

## Intended next implementation

The assistant told the user it would implement GPU shallow-water physics in High quality,
with incoming waves responding to beach depth and rocks. This is a proposed lighter
solver suited to the island, NOT code already written and NOT the same MLS-MPM/SPH
particle-volume solver used by WebGPU-Ocean. Be explicit about that distinction.

Suggested implementation path:

1. Finish and validate the local rock maps/provenance and physical beach geometry.
2. Add a real evolving GPU height/velocity simulation using Three.js render targets,
   finite-depth wave propagation, shoreline/rock obstacles, incoming offshore forcing,
   bounded fixed timesteps and damping. No game-engine randomness or state changes.
3. Feed simulated displacement and finite-difference normals to the water mesh in High.
   Water/beach intersection must determine run-up and foam; remove the painted dry-sand
   treatment in that mode. Keep beach mesh and shader profiles consistent, including
   flat themes, where geometry is clamped below playable land.
4. Mesh draft currently samples the CPU coast field directly; GPU water samples its baked
   256x256 texture. Inspect shoreline alignment and adjust if needed. Shoreward waves
   must not be damped to zero before reaching the beach, as in the current shader.
5. Mount scenery only for Realistic High; cleanly allocate/dispose resources on changes.
   Handle unsupported render-target capabilities with a safe cheaper path. Reduced Motion
   must stop solver advancement. Avoid obstructing harbors, roads, targets, and camera input.
6. Add meaningful physics/geometry tests, then type/lint/build and actual browser checks.
   New physical features are not yet implemented or performance-tested.

## Last successful verification (before the two draft coast files)

- `vp check`: formatting, lint and types passed.
- `vp test run` in `apps/client`: 741 tests across 83 files passed.
- `vp build` in `apps/client`: passed; existing main bundle size warning.
- `node tools/check-engine.mjs` and `node tools/check-assets.mjs`: passed, with four
  pre-existing terrain texture size warnings.
- Chromium: Classic and Realistic at Low/Medium/High/Auto, persisted choices and reload,
  reduced-motion still-frame equality, desktop and 390px phone settings all passed.
  No shader errors or JS exceptions. This verified the old analytic water, not new physics.
- Isolated dev origin 127.0.0.1:5174 is rejected by the game server (WebSocket 403), so
  browser checks used the preview island; multiplayer was not verified.

## Browser tooling / practical notes

- No Playwright installed. `/tmp/hexfall-ocean-check.mjs` is a Node built-in WebSocket CDP
  harness with assertions, settings clicks and screenshots; inspect/adapt before reusing.
- Chromium command previously approved:
  `chromium --headless --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9333 --user-data-dir=/tmp/hexfall-ocean-browser about:blank`
- Isolated dev server command: `vp dev --port 5174 --host 127.0.0.1` in `apps/client`.
- Both temporary server and browser were stopped after verification.
- Existing port 5173 did not reliably reflect settings during earlier verification; use an
  isolated server for this checkout and actual UI clicks. Direct dynamic imports of stores
  can create another module instance with Vite timestamp URLs, invalidating a test.
- Browser automation and local network access require sandbox escalation; saved scoped
  approvals exist for the commands above and `node /tmp/hexfall-ocean-check.mjs`.
- `vp run --filter ... test` fails under sandbox seccomp supervision; direct `vp test run`
  inside the client works.
- Download scratch files exist in /tmp: `hexfall-rock-files.json` and
  `hexfall-rock-{diff,nor_gl,rough}.jpg` (1K maps fetched before the user supplied local 4K).
- Screenshots from last checks: `/tmp/hexfall-check-*.png`.

## Constraints

- Read AGENTS.md. Keep the deterministic Catan engine and game rules unchanged.
- No subagents unless explicitly requested by the user or applicable instructions.
- Preserve concurrent changes to gestures, scene controls and OpenSpec documents.
- User wants action, not another proposal-only response. Resume the unfinished implementation.

## Continuation implemented — 2026-11-07

The earlier draft status above is historical. Raised coast geometry and the three optimized
512px Rock 2 maps are now wired into Realistic High. `waterSimulation.ts` evolves a GPU
height/velocity field with depth-dependent propagation, zero-flux land/rock boundaries,
offshore forcing, damping, breaking and bounded 1/120-second steps. This is a linear
shallow-water height-field approximation with breaking damping, not particle-volume CFD.
High uses simulated displacement/normals and terrain-contact foam. Classic/lower tiers
keep their previous path; float-target capability detection provides fallback. Quality and
board changes dispose GPU objects, and reduced motion stops stepping.

Follow-up: harbor decks are 0.64 wide and aligned to their own coastal edge normal;
chips rest flush on the deck and no longer float or bob. Harbor slots/rules remain unchanged.

Validation: 749 tests / 84 files passed; production build passed (existing bundle warning).
`vp check` passed with an unrelated unused-import warning in the concurrently edited
`tools/resource-icons-gen.mjs`. Asset check passed with the four existing tile-size warnings.
Browser mode/quality switching, persistence, 390px layout, and High reduced-motion identical
screenshots passed, with no shader or JS errors. The isolated preview origin still gets game
server WebSocket rejection; no multiplayer assertion is made.

Actual GPU readback after 1200 steps: all values finite, maximum wave height 0.04294,
35790 moving cells including 2792 shallow cells, zero obstacle leakage, exact frozen-state
equality, and GPU texture count 3 -> 0 after disposal. Probe scratch source is
`/tmp/hexfall-physics-probe.ts`; it is not shipped. Browser screenshots remain in
`/tmp/hexfall-check-*.png`. Final mobile profiling and quiet-machine before/after performance
status are recorded in the OpenSpec tasks/verification notes; do not assume phone validation.

Preserve concurrent wool icon and resource-icons generation edits from the other session.

### Later owner feedback and correction

The on-screen water was still because R3F copies uniform entries during prop application.
The GPU solver itself worked, but changes to the source uniform object were not reaching the
live material. `syncWaterUniforms` now updates that material's entries each frame, with an
actual R3F applyProps regression test. Browser inspection subsequently confirmed advancing
time and `uPhysical=1` in High. Low inspection confirmed advancing time, both texture flags
at 1, and loaded rock color/bump/roughness maps. Earlier screenshots did not validate live
simulation activation, despite the standalone GPU solver tests passing.

Owner accepts Low sea plus rocks: rock scenery now appears in Realistic Low/Medium without
High beach geometry or simulation. Rocks are 35% smaller, lighter and limited to eight in two
clusters plus two singles. Number/harbor chips use pale-yellow paper, camera pitch/yaw facing,
fit labels and probability-dependent font weights. Panning is removed; browser probe confirms
zero camera target after wheel input and attempted target displacement. Zoom/orbit remain.
