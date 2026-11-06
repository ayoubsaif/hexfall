## Context

All turn actions are round `Fab` buttons in `ActionButtons.tsx`, whose enabled state comes from `controlsOf(view, legal, inFlight)`. Roll is in `DiceTray.tsx`, Knight in `DevCards.tsx`, zoom/presets in `ViewControls.tsx` (`requestZoom`, `setViewPreset`). The only global key handler today is `Escape` in `TurnFocus.tsx`. Settings is a sidebar dialog with sections listed in `settings/sections.ts`.

## Goals / Non-Goals

**Goals:**
- One registry of shortcuts feeding key handling, button hints and the Settings list.
- Shortcuts can never do what the button cannot.
- Discoverable: tooltip hints, Keyboard section in Settings, `?` key.

**Non-Goals:**
- User rebinding or persistence of custom keys.
- Shortcuts for dialog choices (discard, Year of Plenty, Monopoly, robber victim) or trade accept/reject.
- Touch gestures; engine, server or protocol changes.

## Decisions

1. **Registry in `apps/client/src/hotkeys/registry.ts`.** A typed `HOTKEYS` array: `{ id, keys: string[], group, labelKey }`. Rendering helpers (`keyLabel`, `hotkeyFor(id)`) read it. Alternative: keys inline per component. Rejected: drift between code, hints and the list.

2. **One global listener, `useHotkeys()`, mounted once in `Hud.tsx`.** It maps `event.key` (lowercased) to an action id, then calls a handler table. Alternative: a library such as react-hotkeys-hook. Rejected: one small listener, no new dependency, easy to guard.

3. **Handlers reuse button logic.** Extract the click bodies in `ActionButtons`, `DiceTray`, `DevCards`, `ViewControls` into small exported functions (e.g. `runAction(id, ctx)`) that check `controlsOf`/`legal` first and return `false` when unavailable. Button `onClick` and the hotkey both call them. Alternative: synthetic `.click()` on the DOM button. Rejected: fragile with tooltips/disabled spans and hidden buttons.

4. **Guards.** Ignore when: `event.repeat`; Ctrl/Meta/Alt held; target is input/textarea/select/contenteditable; a modal is open (Radix sets `[data-state=open][role=dialog]` or `aria-modal`; also check the ui store for mandatory dialogs). `?` is allowed with Shift and opens Settings unless another modal is open. Shift is otherwise not required, so `+` works on `=` layouts via `event.key`.

5. **Key hints.** `Fab` gets an optional `hotkey` prop rendered in the tooltip as a keycap and appended to the accessible description. A shared `<Kbd>` component renders keycaps in tooltips and the Settings list.

6. **Settings section `keyboard`.** Add to `SECTION_IDS` before `about`, icon `Keyboard`, `KeyboardSection.tsx` rendering the registry grouped. `openSettings()` gains an optional section argument so `?` can open directly on it.

7. **Defaults.** Space/R roll, 1/2/3 build, D dev card, B bank, T players, E/Enter end turn, K Knight, +/- zoom, V cycle view, ? help. Enter also activates a focused button natively, so Enter end-turn only fires when focus is on `body`.

8. **i18n.** Labels reuse existing `play.actions.*` strings where they exist; new keys only for group names and the section (`settings.section.keyboard`, `settings.keyboard.*`) in `en` and `es`.

## Risks / Trade-offs

- [Accidental End turn with `E`/`Enter`] → Enter only when nothing is focused; `E` is a deliberate key; same legality as the button.
- [Conflicts with screen readers / browser keys] → no modifier combos hijacked; ignore when Ctrl/Meta/Alt held.
- [`?` needs Shift on many layouts] → also match `event.key === "?"` directly; hint also shown in Settings button tooltip.
- [Hidden buttons on mobile] → hotkeys are no-ops when the control is not shown; touch devices hide the visible hint.
- [Dialog detection brittle] → test with Radix dialogs open; keep the check in one helper.
