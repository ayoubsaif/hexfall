## Why

In a solo game (one human against bots) the human can already send trade offers, but every bot turns every offer down (specs/bots: "Bots SHALL reject every trade offer made to them"), so domestic trade — a core part of each turn (AGENTS.md §11a) — is dead in the most common way the app is played. The player panels also give no sign of which seats are bots, apart from seats a human left ("open seat").

## What Changes

- **Bots answer offers on their merits when the game has only one human.** When at most one seat in the room is a human seat, a bot that receives an offer (on the human's turn, or on the bot's own turn when the human offers to the active bot) accepts it if the trade brings it closer to something it wants to build, and rejects it otherwise. It never accepts a trade it cannot pay (`legal.acceptTrade` only) and never feeds a player close to winning.
- With two or more human seats, bots keep rejecting every offer (today's behavior), so bots never sway a game between people.
- Bots still never propose trades and never counter; bot-to-bot trading does not exist.
- **Bot marker on player panels.** Every bot seat that is not an open seat shows a small robot icon badge next to its name with a localized "Bot" label (icon only on phones, with screen-reader text and tooltip). Open seats keep their existing "open seat" badge.
- **Composer hint for multi-human games.** In the offer composer, bot recipients show the same robot icon; when bots will not trade (two or more humans), a one-line hint says so.
- English and Spanish text for the new label, tooltip and hint.
- No engine or protocol changes: the engine already validates every trade, and `SeatInfo.bot` already reaches the client.

Non-goals: bots proposing or countering trades, bots trading with each other, a difficulty/generosity setting, trading on other players' turns (still illegal per §11a).

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `bots`: "Bots act for themselves" no longer says bots reject every offer; a new requirement defines when and how bots accept offers (one-human rooms only, value-based, never unaffordable, leader protection, no proposals).
- `compact-player-panels`: new requirement that bot seats are marked with a robot icon badge.

## Impact

- `packages/bots/src/`: new `trade.ts` (pure offer judge from the bot's own view), `choose.ts` takes an options argument `{ trade: boolean }` (default `false` keeps today's behavior), tests in `packages/bots/test/`.
- `apps/server/src/rooms/room.ts`: passes `trade: true` to `chooseAction` when the room has at most one human seat; `pendingBots` already wakes bots that hold an open offer. Server test in `apps/server/test/rooms.test.ts`.
- `apps/client/src/hud/PlayerPanels.tsx`, `names.ts` (new `useBotSeat`), `TradePanel.tsx` (recipient icon and hint).
- `apps/client/src/i18n/locales/{en,es}/play.ts` and `dialogs.ts`.
- Builds on the unarchived `player-trading` change (offer composer and tray), which is implemented.
