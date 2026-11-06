## 1. Art assets

- [x] 1.1 Save the supplied reference as `reference` input; crop to the circle interior (no ring), export 500×500 WebP as `villager-beard`
- [x] 1.2 Write one prompt template (flat cartoon, thick outlines, muted earth palette, 10th-century commoner clothing, simple blurred backdrop, bust, centered) and generate 11 more with the reference as style input: 5 men, 6 women (farmer, shepherd, woodcutter, blacksmith, fisher, miller; herbalist, weaver, baker, shepherdess, innkeeper, water-carrier)
- [x] 1.3 Review a contact sheet: reject crowns, nobles, clergy, armor; regenerate until consistent
- [x] 1.4 Export all to `apps/client/public/avatars/<id>.webp` (≤500×500, square, subject within inscribed circle); check file sizes
- [x] 1.5 Add a test that every `AVATAR_IDS` entry has a file within size limits

## 2. Protocol

- [x] 2.1 Add `AVATAR_IDS`, `AvatarId` to `@hexfall/protocol`; add `avatar` to `SeatInfo`, optional `avatar` to `createRoom`/`joinRoom`, new `setAvatar` message, error codes `bad_avatar`, `avatar_taken`
- [x] 2.2 Bump `PROTOCOL_VERSION`; update protocol tests

## 3. Server

- [x] 3.1 Add `avatar` to `StoredSeat`; helper to pick first free avatar and to default old saves by index
- [x] 3.2 Assign avatar on create/join (requested if free, else first free); bots take first free on add
- [x] 3.3 Handle `setAvatar` (lobby only, errors per spec) and broadcast seat list
- [x] 3.4 Include avatar in seat info on resume/snapshot; tests in `rooms.test.ts`, `session.test.ts`, `bots.test.ts`

## 4. Client: component and picker

- [x] 4.1 `useAvatars()` next to `useNames()`; `Avatar` component (sizes xs–lg, seat-color ring, initial fallback, empty alt)
- [x] 4.2 `AvatarPicker` (radio-group semantics, keyboard nav, taken disabled with owner tooltip)
- [x] 4.3 Use picker in start/join form and in the lobby for own seat; remember last choice in prefs; `net/actions.ts` + `net/session.ts` for `setAvatar` and new fields
- [x] 4.4 Show avatars in lobby seat list

## 5. Client: avatars in play

- [x] 5.1 Player panels: avatar before the name (compact on phones)
- [x] 5.2 Trade dialog player choices and offers tray (`from`, targets) show avatars
- [x] 5.3 `toastFor` returns the acting `seat`; `pushToast` stores it; `Toasts` renders the avatar

## 6. Toast placement

- [x] 6.1 Add `--fab-h` layout var in `useHudLayout`
- [x] 6.2 Move `Toasts` out of the top-center container to a bottom-right stack above the action cluster (`items-end`, pointer-events only on toasts), keep `Rejection` in place
- [x] 6.3 Cap visible toasts at 3 in `store/ui.ts`
- [ ] 6.4 Check desktop, tablet, phone portrait and short screens in the browser: no overlap with hand, buttons or status pill

## 6b. Picker selection style

- [x] 6b.1 `AvatarPicker`: square tile per option (`aspect-square`), remove button `rounded-full` + `outline-wait` ring
- [x] 6b.2 Hover = dark translucent overlay (enabled only); selected = stronger overlay + border + check badge; separate focus-visible ring
- [ ] 6b.3 Test: tile is square, selected shows check badge, taken tile has no hover state; check light and dark theme

## 7. i18n and tests

- [x] 7.1 English and Spanish strings: picker title, avatar names, `avatar_taken`, `bad_avatar`
- [x] 7.2 Client tests: Avatar fallback, picker taken/disabled, panels, trade dialog, toast placement/cap; update `helpers.tsx` seat fixtures with `avatar`
- [x] 7.3 Run lint, typecheck and all test suites
