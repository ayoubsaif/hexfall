## Why

The board has two looks, Flat (theme images) and 3D (procedural diorama), with a switch in the HUD. Keeping both doubles the art and code paths to maintain, and the theme images are the look we want. The flat number tokens also have a reading problem: their number is painted facing the top of the board, so once the camera orbits the numbers read sideways or upside down. The harbor markers draw a line icon on top of their badge image, which hides the image art.

## What Changes

- **BREAKING** Remove the 3D board style: the procedural diorama tiles, sea, token and harbor docks, the Flat/3D switch in the HUD, the stored style preference and its device default. The board always uses the theme images (with procedural flat fallbacks when an image is missing).
- Number tokens become **thin 3D chips**: a low disc with a visible edge, resting on the tile, with the number and pips on its top face.
- Each chip's top face **turns around the vertical axis to follow the camera**, so the number and pips are always upright from the viewer's side, at any orbit angle. The chip stays flat on the tile (no tilt).
- Harbor markers **drop the drawn type icon**. The badge shows only its image (the resource art crop for 2:1 harbors, the plain badge for the generic 3:1 harbor) plus the small trade rate.
- Remove the now-unused board-style code, harbor icon paths, translations and tests.

Non-goals: new token or harbor art, 3D chips for harbors (harbors stay flat), tilting chips toward the camera, changes to pieces, the robber, camera limits or the isometric raised island.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `board-view`: remove "Board style preference"; "Flat tiles and 3D pieces" drops the style wording and allows thin token chips; "Number tokens" requires thin chips that face the viewer; "Harbor markers" drops the type icon and keeps image plus rate; "Raised isometric island" drops the style condition.

## Impact

- `apps/client/src/theme/`: delete `style.ts` (and its exports), `fallbacks/diorama/`, `DIORAMA_FALLBACKS`, `TOKEN_LABEL_Y`; `Asset.tsx`, `relief.ts`, `useLandRelief.ts`, `fallbacks/index.ts`, `flat.tsx` lose the style parameter; the flat `token` fallback and themed token become a thin chip.
- `apps/client/src/scene/`: `NumberToken.tsx` (chip + camera-facing label), `HarborMarker.tsx` (flat branch only, no icon), delete `harborIcons.ts`; `labels.ts` loses the harbor icon field.
- `apps/client/src/hud/Hud.tsx`: remove `BoardStyleSwitch`.
- `apps/client/src/i18n/locales/{en,es}/session.ts`: remove `session.hud.boardStyle` and `session.hud.style.*`.
- Tests under `apps/client/test/theme`, `test/scene`, `test/hud`.
- Specs: `board-view` lives in the unarchived `board-topology` and `harbor-icons` changes; archive those first so this delta applies.
