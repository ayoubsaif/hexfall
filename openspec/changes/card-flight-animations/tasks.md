## 1. Mapping

- [x] 1.1 `apps/client/src/game/cardFlights.ts`: `flightsForEvents(events, viewer)` covering produced, startingResources, yearOfPlenty, discarded, paid built, devCardBought, devCardPlayed, stole, monopoly, tradeAccepted, maritimeTrade; per-transfer and per-batch caps; stagger
- [x] 1.2 Unit tests for every event kind, redaction faces and caps

## 2. Overlay

- [x] 2.1 `data-seat` on player panels
- [x] 2.2 `apps/client/src/hud/CardFlights.tsx`: store subscription (updates only, not reduced motion, not hidden), endpoint resolution, Web Animations flight with fade in/out, cleanup
- [x] 2.3 Mount next to `GameSounds` in `Hud.tsx`

## 3. Verify

- [x] 3.1 `vp check` and client tests pass
- [x] 3.2 Watch flights in the running app (bot game)
