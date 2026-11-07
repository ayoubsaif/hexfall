## Context

`GameSounds` already reacts to `useGameStore` writes with `source === "update"` and plays one sound per batch of `lastEvents`. Card flights follow the same pattern. The hand marks resource slots with `data-resource` and dev card slots with `data-card`; player panels get `data-seat`.

## Decisions

1. **Pure mapping** `flightsForEvents(events, viewer)` in `game/cardFlights.ts` returns `{ from, to, face, delay }[]`. Endpoints are `{ kind: "bank" }` or `{ kind: "seat", seat }`; faces are a resource, a dev card or `"back"`. Easy to unit test without a DOM.
2. **Endpoint resolution at spawn time**: the viewer's seat resolves to its hand slot for that face (resource slot, dev card slot, else the hand itself); other seats to `[data-seat]` panels; the bank to the viewport center (the board). A missing element falls back to the bank point.
3. **Motion**: Web Animations API on an absolutely positioned card in a fixed, `pointer-events: none` overlay. 650 ms, fade in over the first 15 %, slight arc and scale-down, fade out over the last 25 %. Cards in one batch stagger 70 ms. At most 6 cards per transfer (a 12-card Monopoly still reads as a stream). These flights are informational overlays, so they exceed the 200 ms limit for HUD transitions on purpose; they never block input.
4. **Suppression**: no flights for snapshots, under reduced motion, or when the document is hidden (avoids a burst on return).
5. **Visible cards**: `produced`, trades, Monopoly and maritime trades are public in the log, so they show faces to everyone. `stole` shows the face only when the view has it (thief, victim); `devCardBought` only for the buyer.

## Risks

- Many simultaneous flights on a busy roll: capped per transfer and the total per batch (40).
