## Context

- **Board styles** (`apps/client/src/theme/style.ts`): `BoardStyle = "flat" | "3d"`, a `useBoardStyle` store with a device default (flat on touch or small screens, 3d otherwise) and a stored preference (`hexfall.boardStyle`). The HUD shows `BoardStyleSwitch` in the corner controls.
- **Where style matters**: `Asset.tsx` (`resolveForStyle` forces procedural fallbacks for flat-kind keys in "3d"; `FALLBACKS[style]`), `fallbacks/index.ts` (`FLAT_FALLBACKS` vs `DIORAMA_FALLBACKS`, the `fallbacks/diorama/` folder), `relief.ts` / `useLandRelief.ts` (raised island only in flat), `flat.tsx` (`TOKEN_LABEL_Y` per style), `HarborMarker.tsx` (flat badge vs 3D dock), i18n `session.hud.boardStyle` / `session.hud.style.*`.
- **Tokens today** (`scene/NumberToken.tsx`): `<Asset assetKey="token" />` draws a flat disc (`FlatShape` "token": `CircleGeometry` + outline ring, image as `map` when the theme maps `token`), then `LabelQuad` lays the number/pips texture flat with the image top toward −Z. The label never turns, so it reads correctly only from the south.
- **Harbors today**: badge image (2:1 harbors map `harbors/<resource>.webp`; generic has no image and uses the fallback color) plus a client-drawn label: a line icon (`harborIcons.ts`) above the rate.
- **Camera**: `OrbitControls` around the origin; unlimited azimuth on a top-down theme, ±25° on an isometric (raised) theme. The canvas renders every frame (no `frameloop="demand"`).

## Goals / Non-Goals

**Goals:**
- One board look; delete the diorama style and everything that only served it.
- Token chips with real (thin) volume whose number is upright from any orbit angle, at negligible cost.
- Harbor badges that show their image art unobstructed.

**Non-Goals:**
- Tilting chips toward the camera, billboarding harbors, new art, camera changes.

## Decisions

1. **Delete the style concept rather than pin it to "flat".** Remove `style.ts`, `BoardStyle`, `useBoardStyle`, `resolveForStyle`'s style branch, `DIORAMA_FALLBACKS` and `fallbacks/diorama/`, `TOKEN_LABEL_Y`, and the HUD switch. `FALLBACKS` becomes a single map; `landRelief(entries)` and `useAsset(key)` lose the style argument. Alternative: keep the type with one value. Rejected: dead branches and tests to maintain for no behavior. A stored `hexfall.boardStyle` is left in place and simply never read (no migration code).

2. **Chip geometry in `flat.tsx`.** Add a `chip` drawing for the `token` key: a `CylinderGeometry(TOKEN_RADIUS, TOKEN_RADIUS, CHIP_HEIGHT, 48)` translated so its base rests on y = 0, with `CHIP_HEIGHT = 0.035` (spec cap 0.05). Materials: top cap uses the token image as `map` when mapped, else `TOKEN_COLOR`; side uses a darker edge color (`CHIP_EDGE`) so the thickness reads; the bottom cap is never seen and shares the side material. The existing outline ring moves to the top face (y = CHIP_HEIGHT + ε). The themed-image path and the procedural fallback both use this one component, so swapping between them never changes size (asset-theming "Model coordinate contract": rests on y = 0). Alternative: a GLB chip model. Rejected: no extra file, and the label still needs client drawing.

3. **One shared camera yaw, applied once per frame.** A `ChipYaw` context in `BoardView` holds a ref list of chip groups. One `useFrame` reads the camera position, computes `yaw = atan2(camera.x − target.x, camera.z − target.z)` from the orbit target (origin), and sets `group.rotation.y = yaw` on every registered group. With yaw θ the group's local +Z points at the camera's side, so the label's image top (−Z) points away and the number is upright on screen. When the camera's horizontal offset is under 1e-4 (looking straight down) the last yaw is kept to avoid flipping. Alternatives: per-chip angle toward the camera (chips fan out slightly near the edges and look inconsistent) or React state per frame (re-renders 18 tokens 60 times a second). Rejected both.

4. **What turns.** The whole chip group (disc, outline, label) turns; the disc is round, so only the label (and any token image art) visibly rotates. The production `Glow` ring and the robber stay outside the turning group, so positions never change.

5. **Label height** is `CHIP_HEIGHT + FLAT_LAYER.label` on the top face, replacing `TOKEN_LABEL_Y`.

6. **Harbor label without icon.** `harborTexture` draws only the rate, smaller (≈ 0.24 of the canvas) and at the bottom of the badge (center y ≈ 0.84) with the existing light halo, so the image center stays clear. `HarborLabel` drops `icon`; `harborIcons.ts` and its test are deleted. Generic harbors keep their fallback badge color, which already differs from the five resource images. Alternative: drop the rate too. Rejected for now: the generic 3:1 harbor would be an unlabeled blank badge; easy to revisit.

7. **HarborMarker keeps only the flat branch** (badge at the slot position, lowered on a raised island). The 3D dock branch and its rotation math go away; `outward()` stays only if still used by link strips (otherwise removed).

## Risks / Trade-offs

- [Players used to the 3D look lose it] → Accepted by request; the stored preference is ignored, nothing errors.
- [Turning labels on the isometric theme] → Turning is limited to ±25° there, so chips turn at most 25°; still upright.
- [Chip edge z-fighting with tile outlines] → The chip base sits at y = 0 over the tile top; the side is opaque and above the tile plane except at the very base, where the tile is coplanar. Add a 0.001 lift if artifacts show.
- [Tests that assert the diorama or the style switch] → Removed or rewritten in the same change (tasks group 5).
- [Archive order] → `board-view` exists only in unarchived `board-topology` (+ `harbor-icons`). Archive those before this change.

## Migration Plan

Client-only, ships in one deploy. Rollback: revert the commit; stored style values are still compatible with the old client.

## Open Questions

None.
