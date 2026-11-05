## 1. Pure helpers and state

- [x] 1.1 Add `isValidOffer(hand, give, get)`, `swapForCounter(offer, hand)` and `offerSidesFor(viewer, offer)` to `apps/client/src/game/cards.ts`, with unit tests in `test/game/cards.test.ts` (gift, like-for-like, over-hand give, counter capped by hand, viewer-side flip)
- [x] 1.2 Add `proposeTrade` to `Controls` in `game/status.ts` (off while in flight or after a win) and cover it in `test/game/status.test.ts`
- [x] 1.3 Add `"trade"` to `DialogKind` and a `tradeDraft` (`{ give, get, to } | null`) to the ui store with an `openTrade(draft)` helper; make `clearIntent` and `resetUi` clear the draft; test in `test/store/stores.test.ts`

## 2. Offer composer

- [x] 2.1 Move `Stepper` from `hud/Dialogs.tsx` to `hud/cards/Stepper.tsx` and import it back in `Dialogs.tsx` (no behavior change)
- [x] 2.2 Create `hud/TradePanel.tsx`: per-resource give and ask steppers (raising one side zeroes the other; give capped by hand; ask capped at 19), recipient toggles for the active player (all on by default, at least one), fixed active-player recipient otherwise, one-line summary, Send offer that sends `proposeTrade` and closes
- [x] 2.3 Mount `TradePanel` next to `MaritimePanel` in the HUD
- [x] 2.4 Component tests: valid send payload, gift disabled, like-for-like zeroing, give cap, no-recipient disabled, non-active fixed recipient, close sends nothing

## 3. Trade with players button

- [x] 3.1 Add a `Handshake` `Fab` labeled "Trade with players" next to Trade with bank in `actions/ActionButtons.tsx`, enabled by `controls.proposeTrade`, opening the composer with all opponents
- [x] 3.2 Button tests (in `test/hud/player-trade.test.tsx`): visible but disabled before the roll, enabled after, absent on another player's turn

## 4. Open offers tray

- [x] 4.1 Create `hud/OffersTray.tsx`: list offers from or to the viewer (excluding ones the viewer declined), oldest first, proposer name in seat color, "You give / You get" as small picture cards with an accessible text line
- [x] 4.2 Incoming entries: Accept (from `legal.acceptTrade`), "you lack the cards" note when only rejectable, Reject (`legal.rejectTrade`), Counter (opens composer via `swapForCounter`, addressed to the proposer)
- [x] 4.3 Own entries: per-recipient deciding/declined status and Cancel (`legal.cancelTrade`)
- [x] 4.4 Make an offer for non-active players when `proposeTrade` is legal (in the tray, or as a small floating button when the tray has no entries)
- [x] 4.5 Mount the tray bottom-left above the hand using `--hand-h`; hide when empty; collapse to a count badge on `max-sm` that expands on tap
- [x] 4.6 Component tests for every tray scenario in `specs/player-trade/spec.md` (incoming, cannot afford, accept payload, declined leaves tray, own offer statuses and cancel, counter prefill, others' offers hidden, turn end empties tray and closes composer)

## 5. Notification

- [x] 5.1 Toast new offers through the existing event toasts (`toastFor` on `tradeOffered`, recipients only; snapshots never toast), and highlight tray entries that arrive after mount for about 2 s
- [x] 5.2 Tests: new offer raises one toast, own offer raises none, resume with an open offer raises none

## 6. Translations

- [x] 6.1 Add `play.actions.tradePlayers`, `dialogs.trade.*` and `play.offers.*` keys (labels, summaries with plurals, statuses, toast, accessible names) to `i18n/locales/en`
- [x] 6.2 Add the same keys in Spanish under `i18n/locales/es`; confirm `test/i18n/catalogs.test.ts` parity passes
- [x] 6.3 Add a Spanish tray test alongside `test/i18n/dialogs-spanish.test.tsx`

## 7. Verify

- [x] 7.1 Run the client typecheck, lint and full test suite
- [x] 7.2 End-to-end test over a fake server running the real engine (`test/integration/session-game.test.ts`): propose to two players, one declines, the other counters, accept the counter, check hands and the log; end the turn with an offer open and confirm it disappears
- [ ] 7.3 Manual playtest in the browser with three tabs (same flow as 7.2), checking tray placement on desktop and phone widths
