## 1. Bots package

- [x] 1.1 Add `src/level.ts` (`BotLevel`, `BOT_LEVELS`, `toBotLevel` fallback to normal) and export it; verify `toBotLevel(undefined)`/unknown → `normal` in `test/levels.test.ts`
- [x] 1.2 Make `judgeOffer(view, seat, offer, level = "normal")` use the guard plus cumulative Hard/Normal/Easy rules (design decision 2); verify each level's scenarios (leader at 8 and 9, extra cards, generous vs fair, second plan, useless, affordable build) in `test/trade.test.ts`
- [x] 1.3 Add a probe test over seeded random hands and offers: acceptances Easy > Normal > Hard, and every Hard acceptance is a Normal one and every Normal one an Easy one
- [x] 1.4 Pass `level` through `ChooseOptions` into `best` (Easy noise 1/3, Hard no jitter) and the robber (Easy random victim, Hard leader); verify in `test/levels.test.ts` that Easy sometimes picks a non-best option, Hard always picks the best, and Hard steals from the leader
- [x] 1.5 Fuzz bots-only games at each level finish with no rejected action (`test/levels.test.ts`); `pnpm exec vp test run` passes in `packages/bots`

## 2. Protocol and server

- [x] 2.1 Add `BotLevel` enum, `SetBotLevelMessage { seat, level }`, `SeatInfo.level` (optional) in `packages/protocol/src/messages.ts`
- [x] 2.2 Add `StoredSeat.level`, `Room.setBotLevel` (host, lobby, not_a_bot checks, saveMeta then broadcast), room state `level` for bot seats, and pass `toBotLevel(seat.level)` to `chooseAction` in `botFire`
- [x] 2.3 Wire `setBotLevel` through `rooms/service.ts` and `session.ts`
- [x] 2.4 Server tests in `test/bot-levels.test.ts`: default Normal in room state, host sets Hard (stored + broadcast), `not_host`, `not_a_bot`, `game_started`, stored seat without level resumes as Normal; `pnpm exec vp test run` passes in `apps/server`

## 3. Client

- [x] 3.1 Add `setBotLevel` to `net/actions.ts` and `net/session.ts`
- [x] 3.2 Lobby: level `<select>` on bot seats for the host, level text for others; en/es strings (`session.lobby.levelNamed`, `levelEasy/Normal/Hard`)
- [x] 3.3 Client test `test/hud/bot-levels.test.tsx`: host change sends `setBotLevel`, guest sees "Hard" and no control; `pnpm exec vp test run` passes in `apps/client`

## 4. Practice form level

- [x] 4.1 Add optional `level` to `AddBotMessage`; `Room.addBot` stores it on the new bot seat; server test: `addBot { level: "easy" }` is stored and broadcast at Easy, `addBot {}` stays Normal
- [x] 4.2 Practice form: "Bot level" select (Easy/Normal/Hard, default Normal) next to the opponents count; `playSolo` passes it and every solo `addBot` carries it; en/es strings; client tests for the select and the sent `addBot` payloads
- [x] 4.3 Start a practice game against Hard bots in the browser; verify the lobby-less game seats Hard bots (room state level)
- [x] 4.4 Game-styled pickers: shared `ChoiceGroup` (parchment buttons, radio-group keys) for the practice opponents/level and the lobby bot level; `SealRadio` (wax-seal radio) for the lobby board, turn timer and starting player; selected secondary buttons use brown leather instead of forest green; verified in the browser
