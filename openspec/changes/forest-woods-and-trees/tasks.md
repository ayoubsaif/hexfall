## 1. Models

- [x] 1.1 `tools/blender/forest-kit.py` -> `models/woods.glb` (log, stump, fern, woodpile, mushrooms). Owner feedback applied: smaller fallen trees as a pile ready to pick up; bridge replaced by a fern.
- [x] 1.2 `tools/blender/forest-trees.py`: 5 faceted trees (3 spruces, birch, broadleaf).
- [x] 1.3 `tools/blender/tree-pack.py`: mix the faceted trees with the 99.Miles pack's 8 background trees into `models/tree.glb` (<= 300 KB, alpha-clipped WebP atlas); pack source kept packed in `tools/blender/source/tree-pack-source.blend`; credit in theme.json.
- [ ] 1.4 Owner approves the look.

## 2. Key and layout

- [x] 2.1 Add `prop.woods` (keys, COAST_KEYS, fallback, theme.json, key-count tests); swap the BlendKit tree credit for 99.Miles (CC BY 4.0).
- [x] 2.2 `hexWoods` in `scene/forestTrees.ts`: dense mixed trees, boulders, woodland props, tufts, all clear of the chip, robber and board spots. Verify: unit tests.
- [x] 2.3 Creek and footbridge tried, then removed at the owner's request.

## 3. Coast

- [x] 3.1 No trees on the coast rim; narrower beach. Verify: coast scatter tests.

## 4. Wrap-up

- [ ] 4.1 Owner approves screenshots.
