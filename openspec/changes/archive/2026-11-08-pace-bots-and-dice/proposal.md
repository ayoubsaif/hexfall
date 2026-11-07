## Why

Bots move every 1.2 s, too fast to follow what they did, and a bot (or the human) can act while the dice are still tumbling on the board, before anyone has seen the result.

## What Changes

- Slower bots while someone is watching: 2 s between moves (was 1.2 s) and 3 s before a bot starts its turn (was 2.2 s).
- After any roll (a turn roll, a roll for order, or one made by the turn timer), the next bot move waits for the dice throw plus 1 s to read it.
- On the client, no game action can be taken while a dice throw is playing: action buttons, the hand's development cards, dialogs, trade panels, the offers tray, hotkeys and board targets are all disabled until the dice rest (or the throw's fallback timeout ends). Rolls shown from a snapshot or under reduced motion never block.
- The dice throw length is shared by server and client in one constant.

Non-goals: changing the throw animation, the turn timer durations, or the speed of bots when nobody is connected.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `bots`: new "Bot pacing" requirement (delays, wait after a roll).
- `board-dice`: new "No actions while the dice roll" requirement.

## Impact

- `packages/protocol/src/timing.ts` (`DICE_THROW_MS`), `apps/server/src/rooms/room.ts` (delays, roll tracking), `apps/client/src/store/dice.ts` (`rolling`), `hud/dice/DiceTray.tsx` (publishes it), `hud/state.ts` (`useInFlight`), `scene/Targets.tsx`, `game/diceThrow.ts`.
- Tests: `apps/server/test/bots.test.ts`, `apps/client/test/hud/DiceTray.test.tsx`.
