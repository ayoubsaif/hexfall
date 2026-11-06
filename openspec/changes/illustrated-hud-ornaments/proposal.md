## Why

The parchment HUD draws its corner brackets with plain CSS lines, dialogs, cards and buttons are rounded while the HUD frame is square, and the button icons are a different painting style from the new avatars. The reference (ornate brass and carved-stone corner pieces on a square frame) needs real illustrated ornaments, one consistent square shape and one icon style.

## What Changes

- Replace the CSS L-bracket `.frame` with image corner ornaments: a large brass filigree corner for dialogs, drawers and the page frame, and a small grey carved-stone corner for cards, tiles and buttons. Each is one generated image, mirrored into four ready-made files so CSS needs no transforms.
- Make every framed surface square: dialogs, sheets, cards, tooltips, tabs, inputs and rectangular buttons lose their rounding. Only avatars, switches, sliders, round icon buttons and count badges keep round shapes.
- Redraw the 14 button icons in the avatar style: flat cel-shading, thick dark outline, muted earthy palette, transparent background, 128 px.
- Dialog cancel buttons and cards use the stone corners instead of the CSS brackets.
- Keep the icon file names, so no component code changes for icons.

## Capabilities

### New Capabilities
- `illustrated-hud-style`: corner ornament images, square shape rule, and the illustrated icon set.

### Modified Capabilities
<!-- None: existing HUD styling is not covered by a current spec. -->

## Impact

- New: `apps/client/public/ui/corners/*.webp` (brass and stone, four orientations each).
- `apps/client/src/style.css` (`.frame`, new `.frame-brass`), `components/ui/{button,card,dialog,sheet,tooltip,tabs,input}.tsx`.
- Replaced: `apps/client/public/ui/icons/*.webp` (same names).
- Tests that assert classes (`rounded-*`) may need updates.
- Out of scope: board art, resource card art, fonts, colors.
