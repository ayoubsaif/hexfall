---
name: blender-asset
description: Build or modify a Hexfall 3D model (GLB) in Blender, by script (headless) or through the Blender MCP, and wire it into the diorama theme. Use when asked to make, change or refine a 3D object for the board (jetty, boat, rocks, trees, walls, coast kit, pieces) "with Blender" or "with the Blender MCP".
---

# Blender asset workflow (Hexfall)

Every model is made by a **Python script saved in the repo**, so it can be rebuilt without the MCP. Never leave scripts or `.blend` files only in a scratchpad.

## Where things live

- `tools/blender/*.py`: one build script per asset (example: `jetty.py`), plus helpers:
  - `export-jetty.py`: joins the `Harbor` collection, applies transforms and exports a Draco GLB. Copy it for new assets.
  - `inspect.py`: dumps a `.blend`'s collections and objects (location, rotation, size, materials) as JSON. Run it on any `.blend` the owner edited by hand before rebuilding, and reuse their edits (see how `jetty.py` loads `Rock.*` from `source/harbor-owner-rocks.blend`).
- `tools/blender/source/*.blend`: saved sources, including the owner's hand edits. Keep them.
- Output GLBs: `apps/client/public/themes/diorama/models/<name>.glb`.

## Running Blender

- Blender 5.2: `"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"`.
- Headless (default, always works): `blender.exe -b --factory-startup --python tools/blender/<asset>.py -- <out.glb> <preview.png> [extra args]`. Filter output with `grep -E "Error|Traceback|TRIS|BOUNDS"`.
- Blender MCP (`blender-mcp` in `~/.Codex.json`; tools `mcp__Blender__execute_blender_code`, `get_objects_summary`, `get_screenshot_of_window_as_image`, `render_viewport_to_path`). It needs Blender open with the MCP add-on started, listening on port 9876. If the tools aren't loaded or the port isn't listening, ask the owner once to start it. If they don't, use headless mode. Even with the MCP, put the final code into the repo script.
- Do not use Higgsfield's cloud "3D Jutsu" Blender tools for this. They are paid and remote.
- Engine names: use `BLENDER_EEVEE` (5.2 has no `BLENDER_EEVEE_NEXT`), `CYCLES` or `BLENDER_WORKBENCH`.

## Game-unit contract

- 1 Blender unit = 1 board unit. Hex circumradius = 1. Land top is at z=0 in Blender (game y=0), and the sea surface is at z=-0.14.
- Blender +Z is up; export with `export_yup=True`, so game +Y is up.
- The origin is the asset's anchor: base centre for props and pieces. The jetty's origin is the coastal edge midpoint, with +X running out to sea and the sea end at most 0.7.
- Scale references: city fallback about 0.36 x 0.14 x 0.22, road 0.72 long, jetty 0.39 long and 0.42 wide, boat `scale: 0.1` in `theme.json`. Import or rebuild the reference objects first when matching style.
- Low poly: about 2k triangles or fewer per asset (per variant for kits). Flat or faceted shading. Principled BSDF base colors in sRGB (see `srgb()` in `jetty.py`). Use vertex colors or simple materials; textures only if the owner approves them.
- Multi-variant kits: root-level meshes named `variant_0..n` in one GLB.
- Keep preview-only context (land, sand, sea planes) in a separate `Context` collection and **exclude it from the export**.

## Export and checks

1. Export only the asset collection as a GLB with Draco (`export_draco_mesh_compression_enable=True`, level 7). Keep each file at 300 KB or less (asset budget).
2. Render a preview PNG (EEVEE, 960x640, sun + soft world) and **show it to the owner** (SendUserFile or Read) before wiring it in. Iterate on their feedback by editing the script, not the GLB.
3. Save the `.blend` to `tools/blender/source/`.
4. Wire it in:
   - Map the key in `apps/client/public/themes/diorama/theme.json` and extend its `source` text: "original work for Hexfall, generated in Blender by a script (tools/blender/<asset>.py)".
   - For a new key: add it to `src/theme/keys.ts` (`ASSET_KEYS` + `ASSET_KIND`), add a procedural fallback in `src/theme/fallbacks/` and register it in `fallbacks/index.ts`, update the key-count tests (`test/theme/manifest.test.ts`, `keys.test.ts`), and update the asset-theming spec's "Asset kinds" list.
5. Verify: `node tools/check-assets.mjs`, `npx tsc --noEmit -p apps/client`, `npx vp test run` in `apps/client`, then look at it in the running game (Chrome tools; headless Chromium renders WebGL blank).

## Don't

- Don't download models or textures yourself. Give the owner the commands.
- Don't copy or trace reference images. They are for style guidance only.
- Don't commit unless asked. If you do, use the git identity from memory.
