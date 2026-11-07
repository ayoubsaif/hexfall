## Why

Cards change hands constantly (production, trades, steals, Monopoly, builds, discards) but the HUD only nudges the count in the hand. Players miss who got what, who stole from whom, and where their own cards went. Short card flights between the bank, the player panels and the viewer's hand make every transfer readable at a glance.

## What Changes

- New **card flights** overlay: for each live game update, small cards fade in at their source, fly to their destination and fade out there.
- Sources and destinations: the **bank** (board center), a **player panel** (other seats), or the **viewer's hand** (the matching resource slot, or the development cards for dev cards).
- Covered events: `produced`, `startingResources`, `yearOfPlenty` (bank → seat); `discarded`, paid `built`, `devCardBought` cost (seat → bank); `devCardBought` card (bank → buyer); `devCardPlayed` (seat → bank); `stole` (victim → thief); `monopoly` (each victim → player); `tradeAccepted` (both directions); `maritimeTrade` (both directions).
- Hidden information stays hidden: a redacted steal or another seat's bought dev card flies as a card back.
- Snapshots (join, reconnect) never animate; reduced motion turns flights off.

## Capabilities

### New Capabilities
- `card-flights`: which events produce flights, their endpoints, timing, card faces and when they are suppressed.

### Modified Capabilities
(none — the existing count-change motion in the hand stays as it is)

## Impact

- Client only (`apps/client`): new `src/game/cardFlights.ts` (pure event → flights mapping with tests), new `src/hud/CardFlights.tsx` overlay mounted next to `GameSounds`, `data-seat` on player panels.
- Engine, protocol and server unchanged.
