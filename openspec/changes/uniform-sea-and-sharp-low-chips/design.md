## Context

`QUALITY` in `apps/client/src/scene/graphicsQuality.ts` holds one row per tier:
`dpr`, `segments` (water plane subdivisions), `waves` (`WAVE_COUNT` define), `shadows`,
`shadowSize`. `Water.tsx` reads the tier directly in four places: `segments`, `waves`, the
`uLow` uniform, coast-rock `detail` (1/2/3), plus `physical = realistic && tier === "high"`,
which mounts `WaterSimulation` and raises the beach. `BoardCanvas.tsx` passes
`dpr={[1, quality.dpr]}`; R3F clamps `devicePixelRatio` into that range. Low's `dpr: 1` is
why chip labels blur on high-density screens: the 256 px label textures are fine, but the
whole canvas is stretched. Auto picks Low up front for `isLowPower()` devices (≤4 cores, or
DPR > 2 on a short side < 700 px), which are mostly phones, so they get hit hardest.

## Goals / Non-Goals

**Goals:**
- One sea look for every tier: High's sea, simulation and rock collisions included.
- Sharp chip labels at Low on high-density screens.

**Non-Goals:**
- Changing the water shader itself (it already has the High wave path).
- Changing Auto's detection or downgrade logic.
- Changing label texture resolution or filtering (not the cause).

## Decisions

1. **One `SEA` constant instead of per-tier sea fields.** Split the sea settings out of
   `QUALITY` into `SEA = { segments: 256, waves: 7, low: false, rockDetail: 3, physical: true }` (High's values;
   the user first chose Low's sea, then asked for High's waves and real collisions with the rocks)
   and have `Water.tsx` read only that. The tier then no longer reaches the sea at all, so a
   future tier edit can't bring the per-tier sea back by accident. *Alternative*: compute the
   sea from `QUALITY.low` inside Water. Rejected, because it keeps the coupling the spec removes.
   Also drop the tier from the shader material `key` so a tier change does not recompile the
   water shader (it would recompile to the same program, causing a visible hitch).

2. **Run `WaterSimulation` at every tier for real rock collisions.** `physical` becomes
   `realistic && SEA.physical && supportsWaterSimulation(renderer)`, with `SEA.physical` true.
   The simulation already treats the coast rocks and shore as closed cells, so waves reflect off
   them, and its breaking channel drives the foam where water hits. *Alternative*: fake it in
   the analytic shader with a foam ring per rock (rock list as a uniform array). Rejected: the
   user asked for real collisions, and that would only paint foam, with no reflected waves.
   `SEA.physical` stays a single switch in case phones can't afford it.

3. **Low `dpr` cap 1 → 1.5, not "device DPR".** A 1.5 cap removes the visible blur (3× phones
   go from a 3× stretch to 2×, and text at 1.5× density reads cleanly) while capping the extra
   cost at 2.25× pixels. The sea now costs High's shader and simulation at every tier, so
   watch frame rate on phones at Low (see Risks). Medium keeps 1.5, so Low and Medium differ
   only in shadows. *Alternative*: leave
   dpr alone and draw chip labels as HTML overlays. Rejected by the user (more work, and
   labels can drift during camera motion).

4. **Interaction with the unarchived sea change.** `realistic-sea-and-coast-textures` adds
   the requirement "Physical High-quality coast" to `sea-coast-rendering`, and that change is
   not archived. This change's `graphics-quality` requirement "Uniform sea across quality
   levels" overrides it. When that change is archived, its "Physical High-quality coast"
   requirement must be dropped or marked superseded (task 4.2). Doing that now would mean
   editing another in-progress change's artifacts.

## Risks / Trade-offs

- [Low now pays for High's shader, the simulation and 2.25× pixels on 3× phones] → The
  `QualitySampler` still measures frame rate but cannot go below Low. If phones drop under
  ~42 fps at Low, follow-ups in order: halve the simulation steps, lower the Low cap to 1.25,
  drop the mesh to 160 segments, or set `SEA.physical` false for Low only.
- [No float render targets (some older mobile GPUs)] → `supportsWaterSimulation` already
  falls back to the analytic waves; every tier falls back the same way, so the sea still
  matches across levels on that device.
- [Medium and Low now look almost alike] → They are; shadows are the remaining difference.
  The Graphics section's descriptions should say so (task 3.1).

## Migration Plan

Client-only, no stored-data change: the `graphicsQuality` preference keeps its values. To
roll back, revert the commit, or set `SEA.physical` back and restore per-tier sea fields.
