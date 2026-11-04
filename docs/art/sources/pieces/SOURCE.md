# Piece model sources

Source meshes for the `diorama` theme's `piece.road`, `piece.settlement` and `piece.city`.
Convert them with `pnpm run models:pieces` (tools/stl-to-glb.mjs), which writes
`apps/client/public/themes/diorama/models/{road,settlement,city}.glb`.

| File           | Asset key        | Author  | Source                              | License   |
| -------------- | ---------------- | ------- | ----------------------------------- | --------- |
| road.stl       | piece.road       | Burgers | https://www.printables.com/@Burgers | CC-BY-4.0 |
| settlement.stl | piece.settlement | Burgers | https://www.printables.com/@Burgers | CC-BY-4.0 |
| city.stl       | piece.city       | Burgers | https://www.printables.com/@Burgers | CC-BY-4.0 |

- Downloaded from Printables by the project owner. The download date was not recorded; the files'
  timestamps are 2025-03-08. Author and license confirmed by the owner on 2026-11-04.
- The STLs are binary, Z-up, in millimetres. The converter turns them Y-up, scales the road to its
  procedural fallback's length and the settlement and city to 1.5x their fallback footprint
  (0.30 and 0.50 units), and thins the road's cross-section to half (`crossScale: 0.5`,
  approved by the owner on 2026-11-04). These are modifications under CC-BY-4.0.
- The in-game Credits dialog shows this attribution, driven by the `credits` list in
  `apps/client/public/themes/diorama/theme.json`.
