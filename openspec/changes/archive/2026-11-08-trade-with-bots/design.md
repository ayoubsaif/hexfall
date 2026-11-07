## Context

- The engine, protocol, server and client already support domestic trade end to end (`player-trading` change). Offers live in `state.offers`, are visible in every `PlayerView`, and a recipient's legal moves list them in `rejectTrade` (always, while open to it) and `acceptTrade` (only when both hands can pay).
- `Room.pendingBots` already wakes a bot that has an entry in `rejectTrade`, and `chooseAction` turns it down (`packages/bots/src/choose.ts`, "No trading" block). So the only missing piece on the server side is the decision itself.
- The bot package is pure and deterministic: it reads only the bot's own `PlayerView` and `LegalActions`, uses its own `BotRng`, never the game RNG.
- `SeatInfo.bot` (true for bot and open seats) and `SeatInfo.open` reach the client in `roomState`; `names.ts` already exposes `useOpenSeat`.

## Goals / Non-Goals

**Goals:**
- A simple, explainable offer judge that a player can learn to work with ("bots take trades that help them build").
- Keep today's reject-all path byte-for-byte when trading is off, so existing bot tests and bots-only fuzz stay valid.

**Non-Goals:**
- Making the bot a strong trader (no hand-tracking of opponents, no pricing of scarcity beyond its own needs).
- Any change to legal-move generation or engine rules.

## Decisions

### 1. Who decides "only one human": the server, per bot move
`room.ts` computes `trade = meta.seats.filter(s => !s.bot).length <= 1` each time it calls `chooseAction`, and passes `{ trade }` as a new optional fourth argument (`ChooseOptions`, default `{ trade: false }`). Computing it per move means an open seat (a human leaving mid-game) switches bots to trading from the next move, matching the spec scenario.
*Alternative*: a room config flag set at start. Rejected: it would go stale when seats open or are taken over, and it adds protocol surface for no gain.

### 2. Offer judge in its own module
New `packages/bots/src/trade.ts` exports `judgeOffer(view, seat, offer): boolean`, pure and RNG-free (the spec requires determinism; jitter is not needed for a yes/no). From the bot's side, it receives `offer.give` and pays `offer.get`.

Scoring:
- Buildable targets for the bot, each with a weight: city 4 (a settlement to upgrade and a city piece left), settlement 4 (settlement piece left), development card 2 (deck not empty), road 1 (road piece left). Pieces and deck counts come from the view.
- `gap(t, hand)` = cards still missing for target `t`.
- `score(hand) = max over targets of weight / (1 + gap)`, plus `0.01 × total cards` so that, all else equal, more cards is better.
- Accept iff: proposer `publicVp < 8`; `score(after) > score(before) + 0.05`; and every target with `gap = 0` before the trade still has `gap = 0` after.

`chooseAction` keeps the cancel step, then, when `trade` is on, takes the first id in `legal.rejectTrade` (oldest open offer to it), looks it up in `view.offers` and returns `acceptTrade` only if `judgeOffer` says yes **and** the id is in `legal.acceptTrade`; otherwise `rejectTrade`. This sits before the roll/build steps, so an offer made to the active bot is answered first.
*Alternative*: reuse `maritime`'s keep/missing logic directly. Rejected: it answers "what to ask the bank for", not "is this bundle good for me"; a separate scorer is easier to test in isolation.

### 3. No bot proposals, no counters
Keeps the bot turn loop unchanged and avoids bots spamming the human with offers. The tray's existing "deciding / declined" states already show the bot's answer.

### 4. Panel badge with the lucide `Bot` icon
`PlayerPanels.tsx` renders `<Badge variant="muted" data-testid="bot-seat" title=…>` with `Bot` from `lucide-react` (already a dependency) and a text label hidden with `max-sm:sr-only short:sr-only`, shown when `bot && !open`. A new `useBotSeat()` in `names.ts` mirrors `useOpenSeat()`, plus `useHumanCount()` for the composer hint. No painted WebP icon: badges in the panel are text badges, and a vector icon keeps the row narrow.
*Alternative*: a corner badge on the avatar. Rejected: the avatar corner already holds the special-card medals.

### 5. Composer hint
`TradePanel.tsx` shows the same icon next to bot recipient names, and `dialogs.trade.botsWontTrade` under the recipients when `useHumanCount() > 1` and a selected recipient is a bot. It does not block sending: the engine and bots still handle the offer (bots decline).

## Risks / Trade-offs

- [Bot too generous: human farms 1-for-1 swaps every turn] → each trade must strictly raise the bot's own score, and the leader rule stops it near the end; acceptable for a casual solo mode.
- [Bot too stingy, trading feels dead again] → the 1-for-2 case (human gives more) is always attractive via the per-card term when it does not hurt a build; tests cover an accepted 1-for-1 that completes a settlement.
- [Latency: human waits one bot delay per answer] → existing `BOT_DELAY_MS` is short; several bots answer in successive fires, and the first accept closes the offer, so later bots have nothing left to answer.
- [Bots-only games] → no human proposes, so `trade: true` never changes their play; the fuzz test still runs with `trade: true` to confirm no rejected actions.

## Migration Plan

No data or protocol migration. Saved games resume with the new behavior; rolling back restores reject-all.
