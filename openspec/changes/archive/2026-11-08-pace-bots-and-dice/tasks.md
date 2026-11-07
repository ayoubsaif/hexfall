## 1. Server

- [x] 1.1 Add `DICE_THROW_MS` to `@hexfall/protocol` and use it for the client `THROW_MS`
- [x] 1.2 Raise `BOT_DELAY_MS` to 2000 and `BOT_TURN_DELAY_MS` to 3000; add `BOT_ROLL_DELAY_MS` and use it for the first bot move after a roll (`rolledVersion` from `diceRolled`/`orderRolled` events); test in `bots.test.ts`

## 2. Client

- [x] 2.1 Add `rolling` to the dice store, publish it from `DiceTray`, and block `useInFlight()` and board targets while it is set; tests in `DiceTray.test.tsx` (controls disabled during the throw, snapshot roll never blocks, cleared on unmount)

## 3. Verify

- [x] 3.1 Typecheck, lint and test suites for protocol, server and client
- [ ] 3.2 Play a solo game in the browser and check bot pacing and that nothing is clickable while the dice tumble
