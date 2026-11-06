## Why

The pointer never tells the player what it can do: dragging the camera shows a plain arrow, and only board build targets switch to a pointer. Players expect the standard affordances (grab/grabbing on a draggable view, pointer on anything clickable). The top of the HUD is also crowded: the Log button, the connection badge and the player panels all compete for the same strip, hiding board space.

## What Changes

- Board canvas cursor: `grab` while idle over the board, `grabbing` while the camera is being dragged (orbit), `pointer` over a pickable build target / robber hex (existing, kept and made consistent).
- Every clickable HUD control shows `cursor: pointer` (buttons, tabs, switches, cards, dice tray when ready, dialog close, selects, menu items, links); disabled controls show `not-allowed` (or `default` where a disabled state is purely informational). Applied once at the shared UI primitives so no control is missed.
- Keep the Log button (the drawer with the Log and Dice-stats tabs) at the top-left; move settings, view controls, game menu and the connection badge to the bottom-left corner.
- Move the connection badge from the top-right to the bottom, in the same corner area, so the top edge holds only Log and the player panels.
- Top edge ends up clean: nothing but Log and player panels (and transient toasts / alerts).
- Layout variables (`--corner-h`, offers tray anchor, status pill, dice dock) account for the relocated controls so nothing overlaps on desktop, tablet, mobile and short screens.

## Capabilities

### New Capabilities
- `pointer-affordances`: cursor behavior for the board canvas (grab / grabbing / pointer) and for interactive HUD controls (pointer / not-allowed); keyboard focus visibility stays intact.
- `hud-bottom-controls`: settings, view controls, game menu and connection badge live in the bottom-left corner; the top edge holds only Log and player panels.

### Modified Capabilities
<!-- None: no existing spec covers the HUD or canvas cursor; board-view requirements are unchanged. -->

## Impact

- `apps/client/src/hud/Hud.tsx` (Log trigger, `ConnectionBadge`, corner cluster, layout hook, panel offsets)
- `apps/client/src/hud/ViewControls.tsx`, `GamePause.tsx`, `settings/SettingsButton.tsx` (cluster ordering)
- `apps/client/src/hud/PlayerPanels.tsx` (top offsets no longer reserve room for the Log button / badge)
- `apps/client/src/scene/Scene.tsx`, `scene/Targets.tsx` (canvas cursor; OrbitControls start/end events)
- `apps/client/src/components/ui/*` (button, tabs, switch, sheet, dialog, tooltip trigger, etc.: cursor classes)
- Client e2e/visual tests that locate the Log button or `connection-status`
- No server, rules-engine or protocol changes.
