## Why

Players can only trade with the bank today. The rules (AGENTS.md §11a) make trading between players a core part of every turn, and the engine, protocol and server already support it (`proposeTrade`, `acceptTrade`, `rejectTrade`, `cancelTrade`, open `offers` in the view, `acceptTrade`/`rejectTrade`/`cancelTrade` ids in the legal moves). Only the client is missing: it never sends an offer and never shows one. Earlier changes (`client-3d`, `hud-tailwind-cards`) explicitly deferred this to a later `trading` change; this is that change.

## What Changes

- New **Trade with players** floating button next to **Trade with bank**, shown on the viewer's own main turn and enabled after the roll when `proposeTrade` is legal.
- New **offer composer** dialog: pick how many of each resource to give and to ask for with steppers, pick which opponents receive the offer (all by default), and send `proposeTrade`. The composer blocks empty sides, the same resource on both sides, and giving cards the viewer does not hold.
- New **open offers tray** in the HUD, always visible while there are open offers that involve the viewer:
  - **Incoming offer** (addressed to the viewer): shows who offers what for what, with **Accept** (enabled only when the id is in `legal.acceptTrade`), **Reject**, and **Counter**.
  - **Own offer**: shows the offer, each addressee's state (waiting / declined), and **Cancel**.
  - Offers between other players are not listed (they still appear in the event log).
- **Counter-offer**: opens the composer prefilled with the offer's sides swapped, addressed only to the other party. It is sent as a new offer; the original stays open until answered or cancelled.
- Non-active players can also make their own offer to the active player from the tray (rules: "either side may propose").
- A short toast and the tray's attention state when a new offer reaches the viewer.
- English and Spanish text for every new label, status and accessible name.
- No engine, protocol or server changes.

Non-goals: offer timeouts or auto-expiry (offers still die when the turn ends), trading with or between non-active players, AI/bot trading, showing opponents' hand contents, sound for offers, trade history beyond the existing event log.

## Capabilities

### New Capabilities
- `player-trade`: the HUD controls for domestic (player-to-player) trading: the Trade with players button, the offer composer, the open offers tray (accept, reject, cancel, counter), how they follow the legal moves, and incoming-offer notification.

### Modified Capabilities
<!-- None. rules-engine "Domestic trade" already describes the behavior; the client-i18n "All user-facing text is translated" requirement already covers the new text. -->

## Impact

- `apps/client/src/hud/`: new `TradePanel.tsx` (composer) and `OffersTray.tsx`; `actions/ActionButtons.tsx` gets the new button; `Hud.tsx` mounts the tray.
- `apps/client/src/store/ui.ts`: new `"trade"` dialog kind plus a composer draft (prefill for counter-offers, recipients).
- `apps/client/src/game/cards.ts` / `status.ts`: pure helpers for offer validation and a `proposeTrade` control flag.
- `apps/client/src/i18n/locales/{en,es}/`: new `dialogs.trade.*` and `play.offers.*` keys.
- Tests in `apps/client/test/` (helpers, composer, tray, Spanish catalog parity).
- Depends on the unarchived `client-3d` and `floating-hud-turn-timer` changes for the HUD it extends; the `client-3d` sentence "the panel SHALL NOT offer trades with other players" still holds, because it applies to the bank panel only.
