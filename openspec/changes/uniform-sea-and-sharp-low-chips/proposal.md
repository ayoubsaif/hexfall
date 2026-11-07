## Why

The sea looks different at each graphics quality. Medium and High also spend most of their extra
GPU time on it, with more waves, a finer mesh and, on High, a GPU wave simulation with raised
sand and rocks. The player wants one sea at every quality, with High's realistic waves, including the swells
breaking against the coast rocks that Low's flat sea lost. Separately, Low renders the board
at 1× pixel density, so on phones and other high-density screens the canvas is stretched and the
number-chip labels look blurry.

## What Changes

- The sea and coast SHALL render the same way at Low, Medium and High, using High's waves:
  full water shading, 7 wave octaves, a fine water mesh whose swells move against the rocks,
  and detailed rocks. This applies in both the Realistic and Classic graphics modes (Classic
  keeps its flat plane).
- The GPU shallow-water simulation (waves reflect off rocks and shore, foam on contact, raised
  beach) runs at every quality level, not only High. This replaces the High-only "Physical
  High-quality coast" requirement of the unarchived `realistic-sea-and-coast-textures` change.
- Low SHALL render at up to 1.5× device pixel density instead of a fixed 1×. Screens at 1×
  are unchanged; sharper screens get crisp chip numbers, pieces and edges.
- Each 2:1 resource harbor chip gets paper tinted with a light shade of its resource colour, so
  the harbor's resource reads at a glance. The 3:1 chip and the number chips stay yellow.
- Harbor piers change from wooden planks on posts to stylized cartoon stone (rounded grey slabs,
  warm gaps, light rims, hairline cracks) on stone pillars under the deck, drawn in code.
- Quality levels still differ in pixel density cap and shadows (Low: no shadows, up to 1.5×;
  Medium: shadows, up to 1.5×; High: larger shadow map, up to 2×).

## Capabilities

### New Capabilities
- `graphics-quality`: What each graphics quality level (Low, Medium, High, Auto) changes,
  covering the uniform sea and the pixel-density cap that keeps chip labels sharp, plus the
  resource harbor chip colours.

### Modified Capabilities
<!-- None in openspec/specs/. The sea-coast-rendering requirement this overrides
     ("Physical High-quality coast") lives in the unarchived change
     realistic-sea-and-coast-textures; see design.md "Interaction with the unarchived sea change". -->

## Impact

- `apps/client/src/scene/graphicsQuality.ts`: the `QUALITY` table (Low `dpr` 1 → 1.5; the sea
  settings move out of the per-tier table).
- `apps/client/src/scene/Water.tsx`: the sea reads one fixed sea setting instead of the tier.
  No physical simulation, and `uLow` stays on.
- `apps/client/src/scene/BoardCanvas.tsx`: unchanged code; it picks up the new Low `dpr`.
- `apps/client/src/scene/HarborDock.tsx`: procedural stone deck and pillars.
- `apps/client/src/scene/ChipDisc.tsx` (paper base colour per chip) and `HarborMarker.tsx`
  (`HARBOR_CHIP_BASE`).
- The GPU water simulation mounts at every tier when supported (design.md, decision 2).
- Tests: `test/scene/waterSimulation.test.ts`, the quality tests and any Water tests that
  assume High-only behavior.
- Performance: High is unchanged. Low and Medium get more expensive: the simulation (256×256
  grid, up to 4 steps a frame), the full wave shader on a 256×256 mesh, and on high-density
  screens Low draws up to 2.25× the pixels.
