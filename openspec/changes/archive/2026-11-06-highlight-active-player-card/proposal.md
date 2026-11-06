## Why

The player card of the seat whose turn it is only gets a thin `ring-wait` ring (`#6f4505`, dark brown) on a brown frame, so it is almost invisible, most of all on the narrow phone layout. Players cannot tell at a glance whose turn it is.

## What Changes

- The active player's card gets a clear highlight: a bright gold ring with a soft glow and a warm tinted background, so the active card stands out from the other cards.
- The highlight follows the turn, and is removed when the game ends.
- Inactive cards are not dimmed, so every player's counts stay readable.
- With reduced motion no pulse runs; the highlight is static. Otherwise a slow, subtle glow pulse is allowed.
- The state stays exposed as `data-active` and `aria-current`, so the highlight is not colour-only.

## Capabilities

### New Capabilities

### Modified Capabilities
- `compact-player-panels`: a requirement is added for how the active player's card is highlighted.

## Impact

- `apps/client/src/hud/PlayerPanels.tsx` (classes on the card), `apps/client/src/style.css` (highlight styles and pulse).
- Tests in `apps/client/test/hud` for the active card.
- No engine, protocol or server change.
