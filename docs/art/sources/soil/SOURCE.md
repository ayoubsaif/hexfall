# Soil texture (hex block walls)

`apps/client/public/textures/soil.webp` is built by `node tools/soil-texture.mjs` from `soil.jpg`
(980 x 980; the flat border is cropped, scaled to 512 px, WebP, 13 KB). `SoilWalls` in
`apps/client/src/theme/flat.tsx` tiles it mirrored around and down every land block.

- Source: Vecteezy, "Ground texture soil top view in cartoon style with stones", preview image
  https://static.vecteezy.com/system/resources/previews/024/054/400/non_2x/ground-texture-soil-top-view-in-cartoon-style-with-stones-and-texture-seamless-game-interface-background-brown-earth-illustration-vector.jpg
- The project owner chose it and supplied the URL on 2026-11-06.
- **Open question: license.** Vecteezy's free license requires attribution and does not cover every
  use; the file here is the free preview. Confirm the license (or buy / replace it) before release,
  and add an attribution if required. It lives outside `public/themes/`, so `tools/check-assets.mjs`
  (CC0 / CC-BY / MIT only) does not check it.
