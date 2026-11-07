## 1. Beach

- [x] 1.1 Steepen `beachHeight` (`BEACH_SLOPE_END` 0.75) and build `beachHeightGlsl` from the same constants; update `waterSimulation.test.ts` expectations
- [x] 1.2 Reduce shoreline variation in `sampleCoast`, clamp `shore ≤ d + 0.05`, and narrow the stylized sea's beach band in `Water.tsx`; tests: waterline mean ≤ 0.35 and max ≤ 0.7 outside the edges, dry within 0.05, variation still present

## 2. Boats

- [x] 2.1 Add `boatFloat.ts` with `boatDistance`, use it in `HarborMarker`; test that every harbor boat of the board layout has its centre and hull ends over water of at least the minimum depth
- [x] 2.2 Bob boats in `useSailRigs` (rise/fall and roll, phased per boat, still under reduced motion)

## 3. Verify

- [x] 3.1 Client typecheck, lint and full test suite
- [x] 3.2 Look at the board in the browser: water close to the hexes, boats on water and bobbing
