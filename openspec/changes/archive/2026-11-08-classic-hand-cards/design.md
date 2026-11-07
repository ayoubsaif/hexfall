## Context

`GameCard` draws every card. The edge hand uses `layout="peek"` (`Hand.tsx`, `DevCards.tsx`); dialogs use the default layout. Today a stack is two diagonal `box-shadow` edges, and the hover fan is a set of `data-card-ghost` spans that only repeat the face background, rising 20 % each. Each hand slot (`HAND_SLOT`) already uses `translate`, so it is its own stacking context and the ghosts' `-z-10` stays inside it.

## Decisions

### 1. One face for the front card and the cards behind
Extract the peek face (parchment, rim, large icon, corner icon, or the dev art) into a small `PeekFace` inside `GameCard.tsx`. The front card and every ghost render it, so cards behind show "all card details". Ghosts stay `aria-hidden`.
*Alternative*: render full `GameCard`s behind. Rejected: each would carry its own badge, sr-only label and focus handling.

### 2. Classic look from existing tokens
Border: `bg-leather` padding around the face (the same `--color-leather` as player cards). Face: `--color-paper` plus `/ui/parchment.jpg` (already cached for the HUD), with the resource color as an inset ring (`inset 0 0 0 3px var(--frame)`) and a thin dark inner line. No stone corner plates: at 52–72 px wide they would cover the corner icon. Corner icon: the same painted resource icon at about 26 % of the card width, top-left.

### 3. Stack and fan with one set of ghosts
Ghost `k` (1-based, up to 8) is a full card behind the front one.
- At rest: ghosts 1–2 are visible, raised `k × 6 %` of the card height; the rest are hidden. This replaces the `box-shadow` edges.
- Hover / focus-within on the slot: all ghosts visible, raised `k × 10 %`.
- `motion-reduce:transition-none` keeps the end state without animation.
Tooltip offset (`fanOffset`) follows the new 10 % step.

## Risks / Trade-offs

- [Parchment is light; a pale icon could wash out] → the resource-colored rim and the icon's drop shadow keep each card identifiable; dimmed (zero) cards keep `opacity-35 saturate-50`.
- [Tests read `style.boxShadow` for stacks] → update them to count visible ghosts instead.
