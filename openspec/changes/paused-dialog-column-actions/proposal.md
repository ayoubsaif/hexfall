## Why

The host's paused notice puts three buttons (Leave, End game, Resume game) side by side in a 380 px dialog. Buttons never shrink or wrap and the footer is `justify-end`, so in Spanish the row is ~500 px wide and the Leave button spills off the left edge, under the corner ornament, where it cannot be scrolled to or pressed. The host cannot leave from the paused screen.

## What Changes

- The paused notice shows its actions as a column: one full-width button per row, each with a painted gold icon, a label and a short hint line, in the same row style as the in-game "Game options" menu.
- Row order: **Resume game** (primary, host only), **End game** (host only), **Play another game** (everyone), **Leave game** (everyone).
- **New: Play another game.** Today the paused notice cannot be dismissed, so a player's only ways out are closing the tab or "Leave game", which hands the seat to a bot for good. The new row goes back to the start screen while keeping the seat: the paused game stays in "Your games" to continue later, and the player can host, join or practise another game in the meantime.
- Three new painted HUD icons: `resume`, `end-game` and `home`, generated with the Gemini image API in the existing icon style. Leave keeps the existing `leave` icon.
- A new generator script `tools/hud-icons-gen.mjs` for gold HUD icons, modelled on `tools/resource-icons-gen.mjs` (existing icons as style references, chroma-green key-out, 128 px transparent WebP).
- New strings (English and Spanish): the Resume hint and the Play another game label and hint. End and Leave reuse their existing hints (`pause.endNowHint`, `leave.hint`).
- Safety net: the shared `DialogFooter` wraps its buttons, so no dialog can push a button outside its box.

## Capabilities

### New Capabilities

### Modified Capabilities
- `game-pause`: "Paused screen" now specifies the stacked action rows (order, icons, hints, all reachable inside the dialog) and the new "Play another game" action that returns to the start screen and keeps the seat.
- `illustrated-hud-style`: "Illustrated icon set" no longer pins a fixed count and includes the new `resume` and `end-game` icons.

## Impact

- `apps/client/src/hud/GamePause.tsx` (`PausedNotice`).
- `apps/client/src/hud/GameIcon.tsx` (`GameIconName` gains `resume`, `end-game`, `home`).
- `apps/client/src/components/ui/dialog.tsx` (`DialogFooter` gets `flex-wrap`).
- `apps/client/src/i18n/locales/{en,es}/session.ts` (`pause.resumeHint`, `pause.playAnother`, `pause.playAnotherHint`).
- `apps/client/src/net/session.ts`, `net/actions.ts` (`backToStart` gains a keep-seat option).
- New assets `apps/client/public/ui/icons/{resume,end-game,home}.webp`.
- New tool `tools/hud-icons-gen.mjs`; needs `GEMINI_API_KEY` in `.env`, run only with the user's approval. No server, protocol or engine changes.
