## Context

`GameHud` renders one absolute column at the top (`Hud.tsx`): `ViewControls` first, `PlayerPanels` (a wrapping `<ol>`) second; on `short` screens the controls float top-right. Panels wrap and change height with badges/countdowns, so anything below moves. `ViewControls` is a single leather/gold bar (zoom −, slider, +, percent, 3 view presets). Wheel events are already classified (touchpad pan / pinch / mouse zoom) in `scene/gestures.ts`; coarse pointers are already styled via Tailwind `pointer-coarse:`.

## Goals / Non-Goals

**Goals:**
- Player panels in one fixed, non-wrapping, stable-height top container.
- View controls directly under it, thinner.
- Google Maps-style controls for touchscreen and touchpad; mouse look unchanged.

**Non-Goals:**
- No change to camera math, zoom range, presets, or gesture handling.
- No new settings toggle for the theme (follows detected input).
- No server, protocol or rules changes.

## Decisions

1. **Top container = one flex column wrapper, panels row `flex-nowrap`.** Panels get `min-w-0 flex-1` with truncating names and a capped max width; stats stay on one line (compact short labels from the existing `max-sm`/`short` rules apply earlier). Badges (longest road etc.) move into the head row as small chips instead of a third row, so height is constant. Alternative: `position: fixed` with measured height — rejected, HUD root is already absolute and a CSS var for height is unnecessary when height is stable.
2. **View controls render as the next child of the same wrapper** (`mt-1`, left-aligned), replacing the `short:absolute top-right` special case. Alternative: keep top-right on short screens — rejected, user asked for "just after the container" everywhere.
3. **Thin = h-7 buttons (mouse), `py-0.5`, slider `w-20 h-1` track; touch keeps 40px hit areas via the Google style** (hit area, not visual size, via padding). Alternative: shrink everything uniformly — rejected, breaks touch targets.
4. **Input kind in `useViewStore`: `inputKind: "mouse" | "touch" | "touchpad"`**, default derived from `matchMedia("(pointer: coarse)")` (touch else mouse). Updated by: `pointerdown/move` with `pointerType === "touch"` → `touch`; `pointerType === "mouse"` → `mouse`; wheel classified as touchpad pan/pinch by `gestures.ts` → `touchpad`; classified mouse-wheel zoom → `mouse`. Sticky until a different signal arrives. Alternative: CSS `pointer-coarse` only — rejected, cannot see touchpads and hybrid devices.
5. **Theme via `data-input` attribute on the controls root** (`touch`/`touchpad` share the "maps" theme, `mouse` the leather theme) with two class sets in `ViewControls.tsx`. Google look: `bg-white text-[#5f6368]`, 2px radius-lg, `shadow-[0_1px_4px_rgba(0,0,0,.3)]`, zoom pair stacked vertically with a `#e6e6e6` divider, view presets as separate round white buttons stacked below the pair or in a row; active preset tinted `#1a73e8`. Slider and percent text hidden in maps theme. Dark-mode not needed: board HUD is already themed independent of OS.
6. **Same handlers, same test ids** (`zoom-in`, `zoom-out`, `view-*`, `view-controls`); `zoom-slider`/`zoom-value` absent only in maps theme.

## Risks / Trade-offs

- Constant-height panels truncate long names → full name in `title` and `sr-only` color name already present.
- Input kind flicker on hybrids → sticky, switches only on a positive signal from another kind; theme change is instant, no layout shift because both themes share the same anchor.
- Touchpad pointer events look like `mouse`; only wheel classification can tell → theme flips to maps after the first touchpad scroll/pinch; acceptable.
- Overlap with in-flight `improve-touch-camera-and-hud-layout` touching the same files → apply after it or merge carefully.
