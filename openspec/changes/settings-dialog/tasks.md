## 1. shadcn block and primitives

- [x] 1.1 In `apps/client`, run `npx shadcn@latest add sidebar-13 slider`; decline overwriting `dialog.tsx`, `sheet.tsx`, `button.tsx`, `tooltip.tsx`; review the diff to `style.css`, `package.json` and new files
- [x] 1.2 Move the generated `settings-dialog.tsx` to `src/settings/SettingsDialog.tsx`; delete the unused block page; fix imports and lint/type errors in generated files
- [x] 1.3 Map the `--sidebar*` variables to HUD tokens, drop the dark block, add `@theme` color entries if missing
- [x] 1.4 Verify Radix portals still render into the HUD root (existing `components/ui` tests green)

## 2. Preferences

- [x] 2.1 `store/prefs.ts`: add `volume` (default 0.6, clamped, step 0.05) and `motion` (`system` | `reduce` | `full`); validate fields independently
- [x] 2.2 `audio/engine.ts`: master gain follows `volume`
- [x] 2.3 Motion: `prefersReducedMotion()` uses the preference; `useReducedMotion()` hook; mirror to `document.documentElement.dataset.motion`; redefine `motion-reduce` / `motion-safe` variants in `style.css`
- [x] 2.4 Tests: old record keeps sound/notify with new defaults, invalid values fall back, blocked storage, motion resolution (system × media), volume applied to the gain

## 3. Settings dialog

- [x] 3.1 `SettingsDialog`: dialog + sidebar (desktop) + section picker (below `md`), breadcrumb, page-session last section, accessible title/description, sidebar cookie and shortcut disabled
- [x] 3.2 `LanguageSection`
- [x] 3.3 `SoundSection`: sounds switch, volume slider (disabled when off), Test sound
- [x] 3.4 `NotificationsSection` with a pure `notifyStatus()` (on-push / on-tab-only / off / blocked / unsupported, iOS hint)
- [x] 3.5 `AccessibilitySection`: motion choice
- [x] 3.6 `AboutSection`: version, `CreditsList` moved from `Credits.tsx`, license note
- [x] 3.7 Lazy-load the dialog on first open
- [x] 3.8 i18n keys (en/es) for every label, section and status; remove keys only used by removed controls

## 4. HUD integration

- [x] 4.1 `SettingsButton` (gear) replaces `LanguageSwitch`, `SoundToggle`, `NotifyToggle`, `CreditsButton` in the `Hud.tsx` corner; mount the dialog once in `Hud`
- [x] 4.2 Delete the removed components and their exports; keep `--corner-h` measurement working
- [x] 4.3 Update HUD, i18n and session tests that used the old controls

## 5. Tests and verification

- [x] 5.1 Dialog tests: open from start screen/lobby/game, section navigation, breadcrumb, Escape returns focus, phone picker, language switch updates the open dialog, volume and motion persist, notifications states, credits listed
- [x] 5.2 `pnpm test` passes; lint/format clean for changed files
- [ ] 5.3 Manual check on desktop and a 375 px viewport: one Settings button, every section reachable, dice animation follows the motion choice, test sound respects volume
