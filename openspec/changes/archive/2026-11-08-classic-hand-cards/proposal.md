## Why

The cards in the viewer's hand at the bottom of the screen are flat colored tiles that do not match the classic parchment-and-leather HUD (player cards, dialogs). Stacks are hard to read: cards behind the front card show as diagonal colored edges, and when a stack fans out on hover the cards behind are plain colored backgrounds with no icon or frame.

## What Changes

- Hand cards (the edge hand's "peek" layout) get the classic HUD look: a dark leather border, a parchment face with an inner rim in the resource's color, the large resource icon in the upper half, and a small resource icon in the top-left corner like a playing-card index. Development cards in the hand keep their painted art inside the same leather border.
- A held stack (2 or more of one card) shows the cards behind as real card tops peeking straight up above the front card: one for 2 cards, two for 3 or more. The count badge still shows the exact number.
- On hover or keyboard focus a stack fans upward: each card behind rises a further 10 % of the card height, and each is drawn in full (border, face, corner icon), not just its background color.
- Dialog cards (default layout) are unchanged.

Non-goals: new card art, changes to the hand row layout or overlap, changes to dialog cards.

## Capabilities

### New Capabilities
- `hand-cards`: how resource and development cards in the edge hand look, how stacks are drawn at rest, and how they fan out on hover or focus.

### Modified Capabilities
<!-- None: no archived spec describes the hand card face or its fan. -->

## Impact

- `apps/client/src/hud/cards/GameCard.tsx` (peek face, stack and fan), `apps/client/src/hud/DevCards.tsx` (`fanOffset` step for tooltips), `apps/client/src/style.css` if a shared class is needed.
- Tests: `apps/client/test/hud/GameCard.test.tsx`, `game-ui-cards.test.tsx`, `floating-hud.test.tsx`.
