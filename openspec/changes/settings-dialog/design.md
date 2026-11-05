## Context

- The HUD corner (`hud/Hud.tsx`) renders `LanguageSwitch`, `SoundToggle`, `NotifyToggle` and `CreditsButton` as separate pills, on the start screen, lobby and game. The corner moves with the layout (above the hand on phones, in the top bar on desktop) and publishes `--corner-h`.
- shadcn is configured (`components.json`, style `new-york`, Tailwind v4 via `@tailwindcss/vite`, tokens in `style.css` `@theme static`). Existing UI primitives (`dialog`, `sheet`, `button`, `tooltip`) are customized: Radix portals render into the HUD root (`components/ui/hud-root.ts`) so they inherit HUD styles.
- Preferences live in `store/prefs.ts` (`hexfall.prefs`: `sound`, `notify`, from `turn-sound-and-push`). Language lives in `hexfall.language` (client-i18n). Reduced motion comes from `prefersReducedMotion()` (matchMedia) in `hud/cards/useCountChange.ts`, used by dice, cards and `scene/motion.ts`, plus three `motion-reduce:` Tailwind variants.
- `sidebar-13` (registry `new-york-v4`) is a `Dialog` containing `SidebarProvider` + `Sidebar collapsible="none" className="hidden md:flex"` + a `main` with a `Breadcrumb` header; it depends on `sidebar`, `breadcrumb`, `button`, `dialog`, and `sidebar` depends on `separator`, `sheet`, `tooltip`, `input`, `skeleton`, `use-mobile`.

## Goals / Non-Goals

**Goals:**
- One Settings button; every client setting in one accessible dialog built from `sidebar-13`.
- Keep existing behavior of language, sound and notification settings; add volume and motion.
- Works on phones (no hidden navigation).

**Non-Goals:**
- Board style (removed by `flat-board-3d-chips`), lobby turn-timer preset, server-side settings, theming/dark-mode switch (the HUD has one look).

## Decisions

### 1. Run the CLI, keep our customized primitives
Run `npx shadcn@latest add sidebar-13 slider` in `apps/client`. When it asks to overwrite existing files (`dialog.tsx`, `sheet.tsx`, `button.tsx`, `tooltip.tsx`), answer **no**: our versions portal into the HUD root and carry HUD styling. New files (`sidebar.tsx`, `breadcrumb.tsx`, `separator.tsx`, `input.tsx`, `skeleton.tsx`, `slider.tsx`, `hooks/use-mobile.ts`) are kept as generated except for import paths and lint fixes. The generated block page (`page.tsx`/app route) is not used; `components/settings-dialog.tsx` is moved to `src/settings/SettingsDialog.tsx` and rewritten around real sections. Review the diff the CLI makes to `style.css` and `package.json`.
- *Alternative*: hand-build with `Dialog` + tabs. Rejected: the user asked for `sidebar-13`, and the block gives a tested sidebar menu with keyboard support.

### 2. Map sidebar tokens to HUD tokens
The CLI adds `--sidebar*` CSS variables (light/dark) to `style.css`. Replace their values with HUD tokens (`--sidebar: var(--color-hud-solid)`, `--sidebar-foreground: var(--color-hud-fg)`, `--sidebar-accent` from the accent at low alpha, `--sidebar-ring: var(--color-ring)`, `--sidebar-border: var(--color-border)`) and drop the `.dark` block, so the dialog matches the HUD and needs no theme switch. Add the matching `--color-sidebar*` entries to `@theme` if the CLI does not.

### 3. Dialog structure and phones
`SettingsDialog` = existing `Dialog` (HUD-root portal) → `DialogContent` (`p-0`, `md:max-w-[700px] lg:max-w-[800px]`, `max-h-[min(560px,90dvh)]`) → `SidebarProvider` → `Sidebar collapsible="none"` (`hidden md:flex`) with `SidebarMenuButton`s (buttons, not `<a href="#">`) → `main` with `Breadcrumb` and the section. Below `md`, the header shows a native `<select>` (or a compact segmented list) of sections instead of the breadcrumb page name, so phones can navigate. Section id lives in `useState` initialised from a module-level "last section" value (page-session memory). `SidebarProvider`'s keyboard shortcut (`Ctrl/⌘+B`) is disabled (`collapsible="none"` makes it moot; also pass `open` fixed) and its cookie is never written.

### 4. Sections are small components over existing modules
`src/settings/sections/`:
- `LanguageSection` → `SUPPORTED_LANGUAGES`, `setLanguage`, radio group.
- `SoundSection` → `usePrefsStore` (`sound`, new `volume`), `Switch`-like button (reuse a small `switch` built on `button` with `role="switch"`; adding shadcn `switch` is acceptable too), `Slider`, "Test sound" → `installAudioUnlock`'s resume + `playSound("chime")`.
- `NotificationsSection` → `useNotifyStore`, `enableNotifications`/`disableNotifications`, `notifySupport()`; state text derived by a pure `notifyStatus({ supported, permission, wanted, pushActive, pushKey, standalone })` function (unit-tested). iOS hint when `navigator.standalone === false` on iOS user agents.
- `AccessibilitySection` → `motion` radio group.
- `AboutSection` → `CLIENT_VERSION`, `useTheme()` credits list (the content of today's `CreditsDialog`), license note.
`Credits.tsx` keeps the list component (`CreditsList`) and loses `CreditsButton`/`CreditsDialog`.

### 5. Preferences
`store/prefs.ts` adds `volume: number` (0–1, step 0.05, default 0.6) and `motion: "system" | "reduce" | "full"`; `readPrefs` validates each field independently so old records keep `sound`/`notify`.
- **Volume**: `audio/engine.ts` sets the master gain from `usePrefsStore` (subscribe once when the context is created); `playSound` already checks `sound`.
- **Motion**: `prefersReducedMotion()` becomes `motion === "reduce" || (motion === "system" && matchMedia(...).matches)`; a `useReducedMotion()` hook re-renders on pref or media change for components that need it. `document.documentElement.dataset.motion` mirrors the choice, and `style.css` redefines the Tailwind variants:
  ```css
  @custom-variant motion-reduce {
    :root[data-motion="reduce"] & { @slot; }
    @media (prefers-reduced-motion: reduce) { :root[data-motion="system"] & { @slot; } }
  }
  @custom-variant motion-safe {
    :root[data-motion="full"] & { @slot; }
    @media (prefers-reduced-motion: no-preference) { :root[data-motion="system"] & { @slot; } }
  }
  ```

### 6. Entry point
`SettingsButton` (gear, `aria-label` "Settings", `aria-haspopup="dialog"`) replaces the four corner controls in `Hud.tsx`; the corner keeps its layout classes and `--corner-h` measurement, now with one item. The dialog is mounted once in `Hud` (not inside the corner) so it survives start screen → lobby → game transitions.

### 7. i18n
New `settings` namespace keys (en/es): title, section names, every label and status text. `session.hud`/`common.alerts` keys used only by the removed toggles are deleted or moved; the catalogs test keeps en/es complete.

## Risks / Trade-offs

- [CLI overwrites customized primitives] → answer "no" to overwrites; review `git diff` after the CLI; tests for `hud-root` portals must stay green.
- [Generated code lint/type errors under the repo's strict `vp lint`] → fix in place (imports via `@/`, `radix-ui` package names); keep generated structure for future updates.
- [Bundle growth] → sidebar + slider are small; the dialog is lazy-loaded with `React.lazy` on first open.
- [Concurrent HUD edits in other changes] → this change touches `Hud.tsx` corner only; rebase on `flat-board-3d-chips` (removes `BoardStyleSwitch`) and `player-trading`.
- [Players used to one-tap language/sound] → acceptable: one extra tap; Settings sits where the controls were.

## Migration Plan

Client only. Stored `hexfall.prefs` without new fields reads defaults. No server or protocol change; deploy as a normal client release.

## Open Questions

- Add a keyboard shortcut to open Settings (e.g. `,`)? Not in scope unless requested.
