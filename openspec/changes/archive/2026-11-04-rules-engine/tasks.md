## 1. Shared contracts (lead)

- [x] 1.1 Write `state.ts` (state, phases, actions, events, view types), `rules/errors.ts` (`RuleError`, error codes) and `rules/common.ts` (costs, resource helpers, VP counting, building/edge queries). Verify that `pnpm run check` passes.
- [x] 1.2 Add stub modules with fixed signatures for every agent-owned file (design decision 9), and write `game.ts`: `createGame`, `applyAction` (clone, dispatch, catch `RuleError`, append log, victory check), `endTurn` and the `legalActions` aggregator. Update `index.ts` and `testing.ts`. Verify with `test/game.test.ts`: creation components, invalid player counts, input not mutated (deep-frozen input), JSON round-trip, and a pinned seeded deck order.

## 2. Board rules (board agent)

- [x] 2.1 Implement `rules/placement.ts`: legal setup settlements, setup roads, normal roads (connectivity blocked by opponents), settlements (Distance Rule, own-road connection), cities, piece and cost checks, and the build handlers. Verify with `test/placement.test.ts`: the Distance Rule against own and opponent buildings, blocked connectivity, coastal roads, piece limits, the city returning a settlement, and costs paid to the bank.
- [x] 2.2 Implement `rules/longestRoad.ts`: per-player longest trail and the award rule (design decision 7). Verify with `test/longestRoad.test.ts`: a straight road, a fork, a loop plus branch (= 8), a break by an opponent settlement, keeping on a tie, the set-aside state with tied challengers, re-award, and the 4-point swing.

## 3. Turn flow (flow agent)

- [x] 3.1 Implement `rules/setup.ts`: roll for order with tie re-rolls among the tied, the snake order, settlement then road, starting resources from the second settlement, and the hand-off to the first turn. Verify with `test/setup.test.ts`: 3- and 4-player orders, a given starting player, the tie re-roll, the road touching the new settlement, the resources, and 2 VP each.
- [x] 3.2 Implement `rules/production.ts`: roll dice, pay settlements 1 and cities 2, the robber block and the bank-shortage rule. Verify with `test/production.test.ts`: city ×2, multiple buildings on one hex, the robber block, the shortage with several players and with one player, and other resources unaffected.
- [x] 3.3 Implement `rules/robber.ts`: the discard step (>7, floor(n/2), chosen cards, all before the move), the robber move to a different hex, victim candidates and the random steal. Verify with `test/robber.test.ts`: thresholds 7/8/9/11, discard order, the same-hex rejection, the null victim when no one qualifies, an empty-hand victim, no self-steal, and the roller discarding too.

## 4. Cards and trade (cards agent)

- [x] 4.1 Implement `rules/devCards.ts` and `rules/largestArmy.ts`: buying, the empty deck, one card per turn, bought-this-turn, Knight (no discards, before the roll allowed), Road Building (normal rules, partial supply, early end), Year of Plenty (bank-limited), Monopoly, VP reveal only to reach 10, and Largest Army transfers. Verify with `test/devCards.test.ts` covering each item.
- [x] 4.2 Implement `rules/trade.ts`: offer / accept / reject / cancel, the validation (active party, no gifts, no like-for-like, hands checked at accept), the harbor ownership, the 4:1 / 3:1 / 2:1 rates and bank availability. Verify with `test/trade.test.ts` covering each item, including a harbor usable on the turn it is built.
- [x] 4.3 Implement `view.ts` `playerView(state, seat | null)` (design decision 8). Verify with `test/view.test.ts`: hidden hands and deck, no RNG, steal and purchase redaction, and the spectator view.

## 5. Integration (lead)

- [x] 5.1 Write `test/victory.test.ts` and `test/flow.test.ts`: a win on own turn after a build, the reveal to win, the pending win at turn start, every action rejected after the end, and the 7 → discard → robber → steal → build flow.
- [x] 5.2 Write `test/fuzz.test.ts`: from several seeds, play 400 steps by choosing random actions from `legalActions` (expanding parameter choices), and assert that no listed action errors, card totals are conserved (bank + hands = 95), and the deck plus hands plus played cards = 25.
- [x] 5.3 Run `pnpm run check`, `pnpm run test`, `pnpm run build` and `node tools/check-engine.mjs`. Verify all pass, then update `CHECKPOINT.md` with the rules-engine status.
