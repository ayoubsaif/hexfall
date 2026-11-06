## 1. Styles

- [x] 1.1 Replace `data-[active]:ring-wait` on the player card with a `player-card` class in `PlayerPanels.tsx`
- [x] 1.2 In `style.css` add `.player-card[data-active]`: gold inset ring, inset glow and warm tinted background over the paper
- [x] 1.3 Add a slow glow pulse inside `prefers-reduced-motion: no-preference`; static otherwise

## 2. Tests and check

- [x] 2.1 Test that only the current seat's card has `data-active` and `aria-current`, that it moves with the turn, and that none is active when the game has ended
- [x] 2.2 Run typecheck and all tests
- [ ] 2.3 Check desktop, tablet, phone portrait and short landscape in the browser: ring visible, card size unchanged, no clipping
