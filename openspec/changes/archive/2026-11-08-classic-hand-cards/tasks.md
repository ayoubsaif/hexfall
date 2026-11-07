## 1. Card face

- [x] 1.1 Extract `PeekFace` in `GameCard.tsx`: parchment face with resource rim, large icon in the upper half and a `data-corner-icon` top-left for resources; painted art for dev cards; leather border on peek cards only; verify dialog cards render as before (`GameCard.test.tsx`, `game-ui-dialogs.test.tsx` pass)

## 2. Stack and fan

- [x] 2.1 Replace the stack `box-shadow` with ghosts that render `PeekFace`: ghosts 1–2 visible at rest raised k × 6 %, all (up to 8) visible on slot hover/focus raised k × 10 %, reduced motion without transition
- [x] 2.2 Change `fanOffset` in `DevCards.tsx` to the 10 % step

## 3. Tests and verification

- [x] 3.1 Update `game-ui-cards.test.tsx` (stack drawn by ghosts, not box-shadow) and add tests: corner icon on hand resource cards and not on dialog cards; 1 card → no ghosts, 2 → one ghost visible at rest, 5 → four ghosts with two visible at rest; ghosts contain the icon and corner icon and are `aria-hidden`; the slot still reads "Wool, 4"
- [x] 3.2 Run the client typecheck, lint and full test suite
- [ ] 3.3 Look at the hand in the browser on desktop and phone widths (rest and hover)
