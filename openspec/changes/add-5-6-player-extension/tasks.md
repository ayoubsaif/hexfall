## 1. Topology per layout (engine)

- [x] 1.1 Generalize `topology.ts` `build()` to take a hex list and harbor positions; build `STANDARD_TOPOLOGY` with today's ids and keep `TOPOLOGY` as an alias; verify all existing topology tests pass unchanged
- [x] 1.2 Add `LARGE_TOPOLOGY` (rows 3-4-5-6-5-4-3, q ranges per spec, harbor positions 0,3,7,10,14,17,21,24,28,31,35) and `topologyFor(layout)`; verify tests for 30/80/109 counts, 38 coastal paths and intersections, 22 sea cells, 6 corner hexes, symmetric relations, centered world coords and 11 disjoint harbor slots
- [x] 1.3 Add `layout` to `Board` (missing → `standard`) and `topologyOf(board)`; verify a JSON round-trip test and a test reading a board without `layout`

## 2. Large board generation (engine)

- [x] 2.1 Add large terrain/harbor/token bags and `createLargeBoard(rng)` (terrain shuffle, harbor shuffle, token shuffle with red-number reshuffle, robber on lower-id desert); verify component-count, determinism, 200-seed red-number and robber tests
- [x] 2.2 Add a bounded retry count test for the token reshuffle across 1000 seeds and verify the cap's fallback path is covered

## 3. Rules profile and victory target (engine)

- [x] 3.1 Widen `GameConfig` to `playerCount: 3..6` and optional `victoryTarget` (8–15, default 10); reject 5–6 player beginner mode and out-of-range targets; verify creation tests for 3, 5 and 6 players
- [x] 3.2 Add `rulesProfile(playerCount)` (layout, bank 19/24, deck 25/34) and store bank size and target in state; verify the 6-player initial-components test (120 cards, 34-card deck composition)
- [x] 3.3 Replace `BANK_PER_RESOURCE` reads with the state value (production shortage, Year of Plenty, maritime); verify the bank-shortage tests with a 24-card bank
- [x] 3.4 Replace `WIN_VP` with `state.victoryTarget` in `checkVictory`, VP-card reveal and legal moves; verify the target-10, target-12 and target-13 reveal/victory scenarios
- [x] 3.5 Make every rule module read the topology from the board's layout instead of `TOPOLOGY`; verify `grep TOPOLOGY packages/engine/src` only finds the alias and the full engine suite passes
- [x] 3.6 Verify setup snake order for 5 and 6 players (e.g. start seat 4 in 6p: 4,5,0,1,2,3,3,2,1,0,5,4) with a test

## 4. Special Building Phase (engine)

- [x] 4.1 Add the `specialBuild` phase and `passSpecialBuild` action; `endTurn` in 5–6 player games opens windows clockwise from the left of the ender; verify the 5-player window-order test and the 4-player no-phase test
- [x] 4.2 Factor a "may build now" predicate so roads, settlements, cities and dev-card purchase work in a window; verify build-in-window tests including Longest Road recomputation
- [x] 4.3 Reject trades (domestic, maritime), card plays and VP reveal in a window with `not_allowed_in_special_build`; verify one test per refused action
- [x] 4.4 Verify a card bought in a window is playable on the buyer's next turn, and a player reaching the target in a window wins only when their own turn starts
- [x] 4.5 Add window events to the log and redacted views (window opened, pass) and legal-move generation for windows; verify the random-legal-moves fuzz test over seeded 5- and 6-player games to completion

## 5. Protocol

- [x] 5.1 Widen `Seat` and `proposeTrade.to` to 6 seats, maritime count to 24, add optional `victoryTarget` to `StartGameMessage`, add `passSpecialBuild`, add `victoryTarget` and the new phase to the game view; bump the protocol version; verify protocol schema tests including an out-of-range target rejected as `bad_frame`

## 6. Server

- [x] 6.1 Raise `MAX_SEATS` to 6, widen `playerCount` in room and saved-game records, pass `victoryTarget` and seat count to game creation, play beginner starts with 5–6 seats as variable; verify room tests for joining a 6-seat room, `room_full` at 7, and a 6-seat start with target 12
- [x] 6.2 Load stored rooms/games without `victoryTarget` or `layout` as target 10 and standard board; verify with a fixture from the current format
- [x] 6.3 Give each building window its own turn-timer wait and apply `passSpecialBuild` on timeout; verify timer tests for window timeout and pause freezing a window
- [x] 6.4 Confirm the avatar catalog supports 6 unique avatars per room (add entries if needed); verify a 6-seat room test assigns 6 distinct avatars

## 7. Bots

- [x] 7.1 Add a building-window policy (best affordable build by existing scoring, else pass; no trades or card plays) and wire bot scheduling for windows; verify a bot-window test and that bots-only 5- and 6-player games finish
- [x] 7.2 Express `LEADER_VP` thresholds relative to `victoryTarget`; verify trade tests at targets 10 and 14
- [x] 7.3 Allow `addBot` up to 6 seats; verify the `room_full` test at 6 seats

## 8. Client: board scene

- [x] 8.1 Replace direct `TOPOLOGY` use in `scene/layout.ts`, `coastScatter.ts`, `forestTrees.ts`, `mountainPeaks.ts`, `pastureSheep.ts`, `IslandGround.tsx`, `MapSketch.tsx` with the topology of the board in view; verify client tests pass and a large-board scene test draws 30 tiles, 22 sea tiles and 11 harbors
- [x] 8.2 Compute the camera fit radius from the topology extent in `useFitCamera`; verify by screenshots at 16:9 and 9:16 that the whole large board, masts and sails are in view, and the standard board framing is unchanged
- [x] 8.3 Check beach, coast and decoration on the large board outline (no gaps, no overlap with land); verify by screenshot from three camera angles
- [x] 8.4 Remove the `TOPOLOGY` alias; verify `grep -r "TOPOLOGY\b" packages apps` finds no uses and typecheck passes

## 9. Client: HUD, lobby and i18n

- [x] 9.1 Add green and brown seat colors and their en/es names; verify a colors test for seats 0–5 and that `seatColor(5)` no longer throws
- [x] 9.2 Lobby: seat limit 6, victory-target select (8–15, default 10, remembered per device, host only), large-board note at 5–6 seats; solo start with 2–5 opponents; verify Lobby component tests for each
- [x] 9.3 Player panels and top bar: collapsed panel mode for 5–6 seats on narrow screens; verify panel tests at 360 and 390 px with six seats and a desktop test at 1280 px
- [x] 9.4 HUD goal chip and Special Building Phase status/controls (build, buy, pass only in my window); verify HUD tests for the target display and for hidden trade/card controls in a window
- [x] 9.5 Update hardcoded counts in en/es `errors.ts`, `rules.ts`, `session.ts`, `tutorial.ts`, add a 5–6 player section to the rules guide, and log strings for window events; verify the i18n catalog completeness test

## 9b. Lobby without the 3D board

- [x] 9b.1 Mount the 3D board only when a game runs or the host clicks Start (start screen and lobby show the map sketch); verify with test/store/boardVisible.test.ts
- [x] 9b.2 Clear the host's "start" request when the room turns playing (it stayed pending and disabled Pause, End and Leave until a reload); verify with the session test "clears the start request once the room is playing"

## 10. Docs and end-to-end check

- [x] 10.1 Update AGENTS.md with the 5–6 player extension rules and the victory target option, and remove both from §14; verify by reading the diff against the specs
- [x] 10.2 Play a 6-player solo game with 5 bots in the running app to completion; verify windows open in order, the goal chip shows the target, and the winner is declared at the target on their own turn
- [x] 10.3 Run the full test suite, typecheck and asset check; verify all pass
