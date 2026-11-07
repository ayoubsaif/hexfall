## Context

`.frame` in `style.css` draws eight 2 px linear-gradients as brackets; `Button` `secondary`, `Dialog` and cards use it. Dialog, Card, Sheet and Button use `rounded-xl`/`rounded-md`, while `.hud-square` and the player panels are already square. Icons are painted gold webps loaded by `GameIcon` from `/ui/icons/<name>.webp`.

## Goals / Non-Goals

**Goals:** ornate image corners at two sizes; one square shape rule; one icon style that matches the avatars; no component API changes.
**Non-Goals:** redrawing resource cards, board textures, fonts; new icons.

## Decisions

1. **Four pre-flipped files per corner style** (`brass-tl|tr|bl|br.webp`, `stone-…`), made by mirroring one generated top-left image with ImageMagick. CSS `background` layers place each at its corner; no transforms, works in a `::before` that never replaces the surface background. Alternative: four spans or CSS `transform: scaleX(-1)` on separate elements (rejected: extra DOM).
2. **Sizes:** brass 56 px at desktop (40 px on phones) on dialogs, sheets and the splash frame; stone 22 px on cards, tiles and secondary/cancel buttons (16 px on buttons under 36 px tall). Exposed as `--corner-size`.
3. **Utilities:** `.frame` (stone, default) and `.frame-brass`. Existing `frame` users keep working and get the stone corners. Dialog content switches to `frame-brass`.
4. **Square shape:** remove `rounded-*` from Dialog, Card, Sheet, Tooltip, Tabs, Input and Button variants (default, secondary, destructive). `.hud-leather` radius 8 px becomes 0. Keep `rounded-full` on avatars, switches, sliders, badges and the round icon buttons (`.hud-leather-round`).
5. **Icons as one sheet:** one 4×4 grid image on a flat key-color background is generated in the avatar style (one generation keeps the style consistent and costs 1.5 credits instead of 21), then cropped per cell, background keyed to transparent and exported 128 px WebP with the existing names.
6. **Generation of corners:** each from one prompt on a flat key-color background, keyed to transparent, with the reference screenshot as style guide.

## Risks / Trade-offs

- [Icon cells bleed into neighbors or keying leaves a halo] → grid with wide gutters, erode 1 px after keying, review each at 128 px on a leather and a paper background.
- [Ornaments overlap content in small buttons] → stone corners hide below 36 px height; padding already 22 px on plaque buttons.
- [Class-asserting tests break] → update them with the change.
- [Credits are limited (about 20)] → corners and the icon sheet cost about 4.5; the rest is for retries.

## Migration Plan

Asset files replace in place; revert by restoring the old icon files and the old `.frame` rule.
