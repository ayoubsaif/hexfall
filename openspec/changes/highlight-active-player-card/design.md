## Context

`PlayerPanels` already sets `data-active` on the card of the current seat and styles it with `data-[active]:ring-2 data-[active]:ring-wait`. `--color-wait` is `#6f4505`, close to the leather frame, so the ring does not read. The card also has a seat-colour strip on the left and a `frame` corner overlay (`overflow-hidden`), which clips an outer glow.

## Goals / Non-Goals

**Goals:**
- Make the active card obvious at all HUD sizes without hiding other cards' content.
- Reuse the HUD palette (gold `#e8bc4a` / `#c9a04e`, cream paper).

**Non-Goals:**
- No change to turn logic, countdowns, the status pill or the seat colour strip.
- No dimming of inactive cards.

## Decisions

- **Gold ring plus tinted background**, on `[data-active]` in `style.css` (`.player-card[data-active]`): `box-shadow` with an inner 2 px `#e8bc4a` ring, and a warm gradient layered over the paper (`rgb(232 188 74 / 28%)`). Rationale: ring alone is too thin on phones, background alone can be missed; both together are clear. Alternative: seat colour for the ring, rejected because some seat colours (orange, white) clash with the gold frame.
- **Inset glow, not outer**: the card has `overflow-hidden`, so the glow is drawn with `inset` shadows and a `::after` overlay, avoiding layout changes and clipping.
- **Slow pulse** (2.4 s, opacity of the glow only) wrapped in `@media (prefers-reduced-motion: no-preference)`; static otherwise.
- **No dimming**: counts stay readable and the card keeps its size, so nothing shifts when the turn changes.

## Risks / Trade-offs

- Gold highlight close to the gold frame → use a brighter gold and the tinted fill so it differs from the frame line.
- Pulse is distracting → very low amplitude, and off with reduced motion.
