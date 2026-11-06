## Context

`PlayerPanels.tsx` renders each seat as a `frame paper` card with a leather `hud-card-head` (28 px avatar, name, badges) and a body holding a 4-column `dl` (10 px labels, 12 px values) and a 20 px badge row. Mobile and `short:` screens swap labels for 9 px abbreviations (`vpShort`, `cardsShort`, `devShort`, `knightsShort`). Icons are painted gold 128 px webps served by `GameIcon`; avatars are cartoon portraits in a seat-color ring (`Avatar.tsx`, sizes xs–lg).

## Goals / Non-Goals

**Goals:** shorter panels; stats readable at a glance (16–18 px); labels replaced by icons that match the existing icon and avatar style; unchanged data and test hooks.

**Non-Goals:** changing what is shown to whom (hand contents stay hidden), game logic, other HUD cards, resource card art.

## Decisions

1. **One surface, two rows.** Drop `hud-card-head`. Layout: avatar (40 px, 28 px on phones) left; right column has name row (name, You/offline badges, countdown) and a chips row. Keeps the seat color as an inset 4 px left bar. Alternative: keep the leather header and shrink the body (rejected: still two bands, saves little height).
2. **Chips = icon + number.** Each chip is `<dt>` (sr-only text plus `title`) holding a 16–20 px `GameIcon`, and `<dd data-stat>` at 16–18 px bold tabular. Order stays vp, cards, dev, knights. Existing tests keep their selectors.
3. **Icons.** New `vp` (laurel wreath or crown, not a star, since `devcard` already has a star), `hand` (fanned face-up cards, distinct from the card back) and `knight` (chunky helmet). Dev reuses `devcard.webp`. Extend `GameIconName`. Alternative: lucide icons (rejected: different style from the painted set).
4. **Generation.** One Higgsfield image, 4×4 grid, flat key-color background, wide gutters, prompt anchored to the existing icon and an avatar as style references. Cells 1–3 are the new icons; spare cells are retries. Keyed to transparent, eroded 1 px, cropped and exported at 128 px WebP. About 1.5 credits of the 18.21 available. Fallback if credits or quality fail: creative-claw `nano-banana-2` with the same prompt. Review each icon at 16 px on paper and leather before accepting.
5. **Medals.** Longest Road and Largest Army become 16 px gold-ringed `road` / `knight` icons absolutely positioned on the avatar's corner, with `title` and sr-only text. Replaces the badge row.
6. **Hidden VP.** Own panel only: gold `+n` after the VP number, with the existing hidden-VP title; sr-only text keeps the total string.
7. **Responsive.** Under `max-sm` and `short`: avatar 28 px, chips in a 2×2 grid at 14 px numbers (still larger than the old 9–11 px), no abbreviations. Remove the `*Short` i18n keys in `en` and `es`.
8. **Avatar size.** Add an `xl` size (40 px) to `Avatar.tsx`; no other API changes.

## Risks / Trade-offs

- [Generated icons illegible at 16 px] → bold silhouette brief, thick outline, review at 16 px, retry cells.
- [Icon-only stats are ambiguous] → tooltip plus sr-only labels; icons match the ones used elsewhere (`devcard` on the buy button).
- [4 panels × 4 chips overflow on narrow phones] → 2×2 grid, `min-w-0`, truncate the name; verify at 360 px.
- [Class- and text-asserting tests break] → update `game-ui-panels`, `avatars`, `floating-hud`, `play-spanish` with the change.
- [Credits run out] → Gemini fallback.

## Migration Plan

New icon files and component edits only. Revert by restoring `PlayerPanels.tsx` and the removed i18n keys.
