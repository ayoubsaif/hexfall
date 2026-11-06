## 1. Icons

- [x] 1.1 Check Higgsfield balance; generate one 4×4 icon sheet (vp wreath/crown, hand fan of face-up cards, knight helmet, spares) on a flat key color, styled after `devcard.webp` and an avatar; fall back to creative-claw `nano-banana-2` if credits or quality fail
- [x] 1.2 Crop cells, key to transparent, erode 1 px, export `vp.webp`, `hand.webp`, `knight.webp` at 128 px into `apps/client/public/ui/icons/`
- [x] 1.3 Review each icon at 16 px on paper and leather; retry a spare cell if illegible or too close to `devcard`
- [x] 1.4 Add `vp`, `hand`, `knight` to `GameIconName` in `GameIcon.tsx`

## 2. Panel layout

- [x] 2.1 Add an `xl` (40 px) size to `Avatar.tsx`
- [x] 2.2 Rewrite `PlayerPanels.tsx` as one paper card: avatar, name row (You, offline, countdown), four icon+number chips with sr-only labels, `title` tooltips and `dd[data-stat]`; seat color as left bar
- [x] 2.3 Replace the badge row with Longest Road / Largest Army medals on the avatar corner, with tooltip and sr-only text
- [x] 2.4 Show own hidden VP as gold "+n" beside the VP chip
- [x] 2.5 Add phone/short layout: 28 px avatar, 2×2 chips, 14 px numbers; remove abbreviation spans
- [x] 2.6 Add panel/chip styles to `style.css`; remove unused `hud-card-head` rules if nothing else uses them

## 3. i18n

- [x] 3.1 Update `play.panels.stat.*` tooltip text and drop `*Short` keys in `en` and `es` locales

## 4. Tests and verification

- [x] 4.1 Update `game-ui-panels`, `avatars`, `floating-hud` and `play-spanish` tests for the new structure; add tests for medals, hidden VP (own vs opponent) and no abbreviations
- [x] 4.2 Run typecheck, lint and client tests
- [x] 4.3 Check in the browser at desktop and 360 px with 3 and 4 seats, active/offline/countdown states
