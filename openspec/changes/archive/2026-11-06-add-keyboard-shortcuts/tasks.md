## 1. Registry and listener

- [x] 1.1 Create `apps/client/src/hotkeys/registry.ts` with the typed `HOTKEYS` table, groups, `hotkeyFor`, `keyLabel`
- [x] 1.2 Create `hotkeys/useHotkeys.ts`: single keydown listener with guards (repeat, modifiers, inputs, open modal)
- [x] 1.3 Add `<Kbd>` keycap component in `components/ui/`
- [x] 1.4 Unit tests: key matching (case, `+` / `=`, `?`), guard cases, registry has no duplicate keys

## 2. Wire actions

- [x] 2.1 Extract guarded action runners from `ActionButtons.tsx` (build x3, buy dev card, bank, trade players, end turn) and use them in `onClick`
- [x] 2.2 Same for roll dice in `DiceTray.tsx` and Knight in `DevCards.tsx`
- [x] 2.3 Same for zoom in/out and view-preset cycle in `ViewControls.tsx` / `store/view.ts`
- [x] 2.4 Mount `useHotkeys()` in `Hud.tsx`; handlers no-op when the action is disabled or the viewer is not active
- [x] 2.5 Tests: each shortcut runs when enabled, does nothing when disabled / other player's turn / modal open / typing

## 3. Key hints

- [x] 3.1 Add `hotkey` prop to `Fab`; show keycap in tooltip and append to accessible description
- [x] 3.2 Pass hotkeys from `ActionButtons`, `DiceTray`, `DevCards`; add keys to `title` in `ViewControls`
- [x] 3.3 Test: tooltip and aria-description include the key

## 4. Settings Keyboard section

- [x] 4.1 Add `keyboard` to `SECTION_IDS` (before `about`), icon and content in `SettingsDialog.tsx`
- [x] 4.2 Create `settings/sections/KeyboardSection.tsx` listing grouped shortcuts from the registry
- [x] 4.3 Extend `openSettings(section?)`; `?` opens Settings on Keyboard
- [x] 4.4 Add `en` and `es` strings in `settings.ts` / `play.ts`; update settings tests (section list, nav)
- [x] 4.5 Test: `?` opens Keyboard section; Spanish labels render

## 5. Verify

- [x] 5.1 Run client lint, typecheck and tests; fix failures
- [ ] 5.2 Manual check in browser: full turn using only keyboard, tooltips, Settings list, input focus guard
