## Context

The server arms one bot timer per committed version (`armBots`), picking `BOT_FAST_MS`, `BOT_TURN_DELAY_MS` or `BOT_DELAY_MS`. Clients play a physics throw for each new roll, up to `THROW_MS` (4 s); `DiceTray` already knows when a throw is animating and when it has settled (board report or timeout fallback). Every action control reads `useInFlight()`; board targets read the store directly.

## Decisions

1. **Shared throw length.** `DICE_THROW_MS` lives in `@hexfall/protocol` (both sides already depend on it); the client's `THROW_MS` re-exports it and the server's `BOT_ROLL_DELAY_MS = DICE_THROW_MS + 1000`.
2. **Detect rolls from events.** `commit` records `rolledVersion` when the new log events include `diceRolled` or `orderRolled`, so timer-driven rolls count too. `armBots` uses the roll delay when `rolledVersion === version`.
3. **One client gate.** `DiceTray` (always mounted in a game, even when it draws nothing) publishes `rolling = animate && !settled` to the dice store, and clears it on unmount. `useInFlight()` and `Targets` treat `rolling` like an action in flight, so every control, dialog, hotkey and board pick is covered without touching each one.
*Alternative*: gate in `controlsOf` only. Rejected: dialogs, offers and board targets don't all go through it.

## Risks / Trade-offs

- [A human's discard or turn countdown keeps running during the throw] → the shortest wait is 30 s; a 4 s block is acceptable.
- [Slower solo games] → only while someone is connected; delays are constants in `room.ts`.
