# Design: Aurora Background

## Rendering layers

```
html/body/#root   background: #060e14  (near-black base)
  .app  position: relative; overflow: hidden
    .app::before   radial-gradient blobs, top-left   <-- behind canvas
    .app::after    radial-gradient blobs, bottom-right
    .canvas        position: absolute; inset: 0  (WebGL, opaque)
    .hud           position: absolute; z-index: 10
```

Pseudo-elements are painted as part of `.app` before its children, so they are naturally behind `.canvas` without needing `z-index`.

## Why transform-only animation

`filter: blur()` forces a raster repaint on every frame. `background-position` animation also triggers paint. `transform: translate()` runs entirely on the compositor thread — no layout, no paint. The blobs are large and slow (19–24 s), so `will-change: transform` is not needed.

## Why no filter: blur()

Softness comes from wide radial-gradient falloffs (`transparent 62–68%`), which are indistinguishable from blurred blobs at the opacity levels used (8–13%). Zero runtime blur cost.

## Colour binding

```css
color-mix(in srgb, var(--hud-muted) 13%, transparent)  /* ocean teal  */
color-mix(in srgb, var(--hud-ok)    9%,  transparent)  /* forest green */
color-mix(in srgb, var(--hud-wait)  10%, transparent)  /* grain amber  */
color-mix(in srgb, var(--hud-bad)   8%,  transparent)  /* brick red    */
```

Using `color-mix` keeps the blobs in sync with any future HUD palette changes. Browser support: Chrome 111+, Firefox 113+, Safari 16.2+.

## Blob placement

| Pseudo     | Position      | Size     | Duration | Terrain mood      |
|------------|---------------|----------|----------|-------------------|
| `::before` | top-left      | 75 vmin  | 24 s     | Ocean + Forest    |
| `::after`  | bottom-right  | 65 vmin  | 19 s     | Grain + Brick     |

Different sizes and staggered durations prevent the blobs from moving in sync.

## Accessibility

`prefers-reduced-motion: reduce` disables both animations. Static blobs remain visible (the gradient is present without motion).
