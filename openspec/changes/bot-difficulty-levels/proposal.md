## Why

Bots have one fixed level, and it is a hard trading partner: on 2,000 random hands the trade judge accepts only about 25% of offers, and offering 2 or 3 cards for 1 doesn't help, because the judge ignores extra cards and only values trades that shorten its single best build. New players find bots stingy; strong players have no harder opponent. A per-seat level lets the host tune each bot.

## What Changes

- Three bot levels: **Easy**, **Normal** (default) and **Hard**, stored per bot seat.
- **Trade judge** by level:
  - Easy accepts any offer that doesn't leave it worse off, counting extra cards as worth something, and never refuses a leader.
  - Normal accepts fair or generous offers (it gets at least as many cards as it gives) that bring any build target closer without making its hand worse; it refuses a proposer at 9+ public VP.
  - Hard keeps today's strict rule: only trades that shorten its best build, refuses a proposer at 8+ public VP.
  - All levels still never give up a card needed for a build they can already afford.
- **Move choice** by level: Easy sometimes (about one decision in three) picks a random legal option instead of the best; Normal plays as today; Hard always plays its best-scored option. All randomness comes from the bot's own seeded `BotRng`, so games stay deterministic.
- **Robber and steal targeting** by level: Easy steals from a random qualifying opponent; Normal as today (score of public VP and hand size); Hard places the robber to hurt the public-VP leader and steals from the leader.
- Lobby: the host sets each bot seat's level with a control next to the seat; other players see the level. New protocol message `setBotLevel { seat, level }` (host only, lobby only); `SeatInfo.level` on bot seats. English and Spanish text.
- Rooms and saved games without the field, and seats a human left during the game, play at Normal.

Non-goals: no change to the rules engine or its legal moves, no level change after the start, no bot-proposed trades, no change to when bots trade (still only with one human in the room).

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `bots`: new "Bot difficulty levels" requirement (levels, storage, fallback, lobby control); "Bots trade with a lone human" judges offers by the bot's level; "Lobby bot controls" adds the level control.

## Impact

- `packages/bots`: `src/level.ts` (new), `src/trade.ts`, `src/choose.ts`, `src/index.ts`; tests in `test/levels.test.ts`, `test/trade.test.ts`.
- `packages/protocol/src/messages.ts`: `BotLevel`, `SetBotLevelMessage`, `SeatInfo.level`, client message union.
- `apps/server`: `store/types.ts` (`StoredSeat.level`), `rooms/room.ts` (`setBotLevel`, room state, `chooseAction` options), `rooms/service.ts`, `session.ts`; tests in `test/bot-levels.test.ts`.
- `apps/client`: `hud/Lobby.tsx`, `net/actions.ts`, `net/session.ts`, `i18n/locales/{en,es}/session.ts`; tests in `test/hud/bot-levels.test.tsx`.
- `packages/engine`: untouched.
