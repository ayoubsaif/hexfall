## Context

Domestic trade is done everywhere except the client:

- **Engine** (`packages/engine/src/rules/trade.ts`): `proposeTrade` (active player to any set of opponents; non-active player to the active player only), `acceptTrade`, `rejectTrade`, `cancelTrade`. Validates gifts, like-for-like, card ownership, phase and roll. Offers are dropped when the turn ends (`rules/turn.ts`) and when the game ends.
- **Legal moves** (`LegalActions`): `proposeTrade: boolean`, and `acceptTrade` / `rejectTrade` / `cancelTrade` as lists of offer ids the seat may use now. `acceptTrade` already excludes offers where either side lacks the cards.
- **View** (`PlayerView.offers`): every open offer, `{id, from, to, give, get, rejectedBy}`. Offers are public in the rules, so the view does not redact them.
- **Protocol / server**: the four actions are in the schema and pass through the authoritative reducer. Answering an offer does not restart the turn timer (`floating-hud-turn-timer`).
- **Event log**: `tradeOffered`, `tradeAccepted`, `tradeRejected`, `tradeCancelled` are already described in English and Spanish.
- **Client**: `MaritimePanel.tsx` (bank trade dialog), `Dialogs.tsx` (has a `Stepper` with picture cards), `actions/ActionButtons.tsx` (floating `Fab`s), `store/ui.ts` (`dialog` kind, intent cleared on phase/turn change, toasts). `offers` is never read.

## Goals / Non-Goals

**Goals:**
- Let players propose, accept, reject, cancel and counter player trades from the HUD, using only data the server already sends.
- The UI offers only what the legal moves allow; the server stays the judge.
- Same visual language as the bank trade dialog and the floating controls.

**Non-Goals:**
- Engine, protocol or server changes.
- Offer expiry, per-offer timers, rate limits beyond the server's existing abuse limits.
- Bots, trade suggestions, sounds.

## Decisions

1. **Client-only change.** The engine rules match AGENTS.md §11a (active player always a party, no gifts, no like-for-like, resources only) and are already tested in `packages/engine/test/trade.test.ts`. Alternative: add engine conveniences such as a "counter" action linked to the original offer. Rejected: the rules spec says counter-offers are new offers, and linking adds state with no rule behind it.

2. **One composer for new offers and counters.** A `TradePanel` dialog opened through the ui store with `dialog: "trade"` and a `tradeDraft: { give, get, to } | null` prefill. The Trade with players button opens it with an empty draft and all opponents; Counter opens it with the swapped sides and `to: [proposer]`; a non-active player's Make an offer opens it with `to: [active]`. Alternative: a separate counter dialog. Rejected: same fields, same checks.

3. **Two steppers per resource, mutually exclusive.** Each resource row has a give stepper and an ask stepper; raising one zeroes the other. This makes like-for-like impossible instead of reporting it. Give is capped by the hand; ask is uncapped (opponents' hands are hidden), with a soft upper bound of 19 (the bank size per resource) to keep the control sane. Reuse the `Stepper` from `Dialogs.tsx` by moving it to `hud/cards/Stepper.tsx`.

4. **Pure validation helpers** in `game/cards.ts`: `isValidOffer(hand, give, get)`, `swapForCounter(offer, hand)`, `offerSidesFor(viewer, offer)` (returns "you give"/"you get" from the viewer's side). Tested without React, like the existing maritime helpers.

5. **Tray reads `view.offers`, buttons read legal ids.** `OffersTray` filters offers to those from the viewer or addressed to the viewer and not in `rejectedBy`. Accept/Reject/Cancel enable from `legal.acceptTrade` / `rejectTrade` / `cancelTrade` (plus `!inFlight`). "You lack the cards" is shown when the offer is addressed to the viewer, not rejected, and its id is in `rejectTrade` but not `acceptTrade`. Alternative: recompute affordability on the client. Rejected: the legal list already encodes it and stays correct if rules change.

6. **Placement.** The tray is a compact stack of cards anchored bottom-left above the hand, on the side opposite the floating action buttons, so it is visible to non-active players (who have no action buttons). It collapses to a count button on small screens (`max-sm`) and expands on tap. It sits above the hand (`--hand-h`) and above the corner controls when those stand at the bottom-left (new `--corner-h` layout variable, 0 on desktop).

7. **New-offer toast from the event stream.** The toast comes from the existing `useEventToasts` path: `toastFor` returns an `info` toast for a `tradeOffered` event addressed to the viewer and not from them. Snapshots (join, resume) never toast there, so resume stays silent without extra state. The tray separately remembers the offer ids open at mount and highlights only ids that arrive later, for ~2 s. (First drafted as an id diff for both; the event path already had the right resume behavior.)

8. **Lifecycle.** The composer closes through the existing `clearIntent` on phase or turn change (for example, when a Knight moves the game to `moveRobber` or the turn ends). An offer vanishing while a counter composer is open does not close it: the counter is a new offer and still valid.

9. **Icon.** `Handshake` from lucide-react for Trade with players; the bank keeps `Landmark`.

## Risks / Trade-offs

- [Spam: a non-active player can send many offers to the active player] → The server's abuse limits already cap message rate; the tray lists offers oldest first and scrolls. Revisit with a per-seat cap only if it shows up in play.
- [Stale Accept: the proposer spends cards after offering] → The engine drops the id from `legal.acceptTrade`, so Accept disables; if a race still sends it, the server rejects with `insufficient_resources`, which already has a translated error toast.
- [Two recipients accept at once] → The first accept wins on the server; the second gets `unknown_offer`, which already shows "That trade offer is gone."
- [Tray overlaps the board on small screens] → Collapsed badge on `max-sm`, and the tray is hidden when empty.
- [Depends on unarchived HUD changes] → `client-3d` and `floating-hud-turn-timer` are implemented in the code; archive them before this change so `player-trade` lands next to a `game-hud` main spec.

## Open Questions

None. (An offer every recipient declined is already removed by the engine, so the tray needs no extra cleanup.)
