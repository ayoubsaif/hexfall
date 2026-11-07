## 1. Offer judge (packages/bots)

- [x] 1.1 Create `packages/bots/src/trade.ts` with `judgeOffer(view, seat, offer)`: targets and weights, `gap`, `score`, the strict-improvement margin, the "keep affordable builds" check and the `publicVp < 8` leader rule (design §2); export it from `src/index.ts`; verify `pnpm --filter @hexfall/bots typecheck` passes
- [x] 1.2 Add `packages/bots/test/trade.test.ts` covering each `judgeOffer` case from the spec: completes a settlement (accept), useless card (reject), breaks an affordable city (reject), proposer at 8 public VP (reject), 1-for-2 in the bot's favor that hurts nothing (accept), same input twice gives the same answer; verify the tests pass

## 2. Bot chooser

- [x] 2.1 Add optional `ChooseOptions { trade: boolean }` (default `false`) as the 4th argument of `chooseAction`; when `trade` is on, answer the oldest offer in `legal.rejectTrade` with `acceptTrade` only if `judgeOffer` agrees and the id is in `legal.acceptTrade`, else `rejectTrade`; keep the cancel step and the reject-all path unchanged when off; update the file header comment
- [x] 2.2 Extend the bot tests (in `packages/bots/test/trade.test.ts`, next to the judge fixtures): with `trade: false` an attractive offer is still rejected; with `trade: true` it is accepted; an offer the bot cannot pay is rejected; an offer to the active bot before its roll is answered before `rollDice`; verify the tests pass
- [x] 2.3 Run the bots-only fuzz in `packages/bots/test/bots.test.ts` with `trade: true` as well and verify every game still ends with a winner and no rejected action

## 3. Server

- [x] 3.1 In `apps/server/src/rooms/room.ts` `botFire`, pass `{ trade: humans <= 1 }` to `chooseAction`, where `humans` counts seats with `bot !== true` at that moment; verify `pnpm --filter server typecheck` passes
- [x] 3.2 Add tests in `apps/server/test/botTrade.test.ts` (seeded stored game): solo room, human offers a helpful trade to a bot and sees `tradeAccepted` with both hands changed; room with two humans, same offer is rejected; offer to two bots that both like it produces exactly one trade; after one of two humans leaves (open seat), a helpful offer is accepted; verify the tests pass

## 4. Client: bot badge on panels

- [x] 4.1 Add `useBotSeat()` and `useHumanCount()` to `apps/client/src/hud/names.ts` (read `SeatInfo.bot` / `open` from the room store)
- [x] 4.2 In `PlayerPanels.tsx` render a muted `Badge` with the lucide `Bot` icon and `data-testid="bot-seat"` for `bot && !open` seats: label visible on desktop, `sr-only` on `max-sm` and `short`, `title` tooltip; check at phone width that the four stat chips still fit
- [x] 4.3 Add `play.panels.bot` and `play.panels.botHint` in `i18n/locales/en/play.ts` and `es/play.ts`; verify `test/i18n/catalogs.test.ts` parity passes
- [x] 4.4 Tests in `apps/client/test/hud/game-ui-panels.test.tsx`: two bot panels show `bot-seat`, the human panel does not, an open seat shows `open-seat` and no `bot-seat`, Spanish tooltip text; verify the tests pass

## 5. Client: composer

- [x] 5.1 In `TradePanel.tsx` show the `Bot` icon (with sr-only label) next to bot recipient names, and the `dialogs.trade.botsWontTrade` hint under the recipients when `useHumanCount() > 1` and a selected recipient is a bot
- [x] 5.2 Add `dialogs.trade.botsWontTrade` in English and Spanish `dialogs.ts`
- [x] 5.3 Tests in `apps/client/test/hud/player-trade.test.tsx`: solo game shows bot icons and no hint; two humans + bot selected shows the hint; deselecting the bot hides it; verify the tests pass

## 6. Specs, docs and verification

- [x] 6.1 Update the "No trading" comment in `choose.ts` and any bots README/notes that say bots never trade
- [x] 6.2 Run typecheck, lint and the full test suite for `packages/bots`, `apps/server` and `apps/client`, and `openspec validate trade-with-bots --strict`
- [ ] 6.3 Manual playtest: start "Play solo vs bots", offer a bot a card it needs for one it has spare and watch it accept; offer a bad trade and watch it decline; check the bot badge on desktop and phone widths
