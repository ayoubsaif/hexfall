## Context

- Board is an R3F canvas with drei `OrbitControls` (`scene/Scene.tsx`). `scene/Targets.tsx` already sets `gl.domElement.style.cursor = "pointer"` while a pickable target is hovered; otherwise the browser default arrow shows, including while dragging.
- HUD controls get `cursor-pointer` ad hoc in some components (`button.tsx`, `switch.tsx`, `GameCard`, `Fab`...) but not uniformly (e.g. tabs, sheet/dialog triggers, tooltip triggers, `ConnectionBadge` is non-interactive).
- `Hud.tsx` places: Log `SheetTrigger` at top-left, `ConnectionBadge` at top-right, player panels between them (`right-[170px] left-3 pt-11`, with landscape/desktop overrides), and a "corner" cluster (settings, view controls, host menu) that is bottom-left in game on non-desktop and joins the top bar on desktop. `useHudLayout` measures the corner and publishes `--corner-h`, which the offers tray and status pill use.

## Goals / Non-Goals

**Goals:**
- Correct, standard cursors on canvas and HUD, with no per-component omissions.
- Top edge holds only player panels; Log/stats button and connection badge sit at the bottom.
- No overlap with hand, FAB cluster, offers tray, dice dock, status pill at any breakpoint.

**Non-Goals:**
- Custom cursor images, touch-gesture changes, redesign of the log drawer contents or the Dice stats tab.
- Changing camera limits or controls behavior.

## Decisions

1. **Canvas cursor via a small hook/state, not per-event style hacks.** Add one owner of `gl.domElement.style.cursor` that resolves: `grabbing` while dragging > `pointer` while hovering a pickable target > `grab` otherwise. Dragging tracked from `OrbitControls` `onStart`/`onEnd`. `Targets.tsx` stops writing the style directly and reports hover to the owner (shared tiny store or callback). Alternative: CSS `:active` on the canvas for grabbing. Rejected: `:active` also fires on a plain click on a target and when pointer leaves; OrbitControls events are exact. Cursor `grab` is shown only when the controls are enabled (not while blocked by a modal/preview).
2. **Pointer cursor at the primitives.** Put `cursor-pointer` on the shared shadcn-style primitives (`button`, `tabs` trigger, `switch`, `sheet`/`dialog` close, select/menu items, slider thumb as `grab`) and `disabled:cursor-not-allowed`. Plus a global CSS rule in the HUD layer for native `a[href]`, `button:not(:disabled)`, `[role=button]`, `[role=tab]`, `summary`, `label[for]` as a safety net so one-off buttons are covered. Alternative: only the global rule. Rejected: explicit classes are clearer and Tailwind preflight resets buttons to `cursor: default` in v4; the global rule is a backstop.
3. **Disabled cursor.** `not-allowed` for disabled interactive controls; `default` where disabled means "not your turn / informational" (existing DiceTray `disabled:cursor-default` stays).
4. **Bottom layout: one bottom-left cluster.** Move Log trigger into the existing corner cluster (settings, view controls, host menu, **Log**), and render the `ConnectionBadge` at the bottom as a compact pill next to the cluster (bottom-left on desktop/tablet; stacked above settings on mobile/short where the cluster is vertical). Desktop in-game: the cluster no longer joins the top bar — it moves to the bottom-left with the rest, so the top bar is just `PlayerPanels` and its `right-[170px]`/`pt-11`/landscape reservations are removed. The Log drawer keeps opening from the right.
   Alternative: bottom-right next to the FAB cluster. Rejected: that area is already the busiest (End turn, dice dock, FAB) and `hudLayout` dock math depends on it.
5. **Layout variables.** `--corner-h` now always measures the bottom cluster (+ badge row) since it is always in the lower half; `hudLayout` input is unchanged, tests adjusted. Offers tray anchor keeps using `--corner-h`.
6. **Connection badge semantics unchanged:** `role=status`, `aria-live=polite`, `data-testid` values kept so e2e selectors still work; only position changes. Out of game (start screen / lobby) the badge stays bottom as well, consistent.

## Risks / Trade-offs

- [Bottom-left crowding with offers tray / hand on small screens] → Offers anchor already offsets by `--corner-h`; verify at 360x640, 667x375 landscape, tablet, desktop; badge collapses to dot + label only (ping hidden) on `max-sm`.
- [`grab` cursor on canvas feels noisy while build targets are shown] → `pointer` wins when hovering a target; `grab` only on empty board.
- [Global cursor rule overrides component choices] → Scoped to enabled elements only; `disabled` rules come after.
- [Tests referencing Log button position / top-right badge] → Update selectors; they use test ids/roles, not coordinates (check during tasks).
- [Working tree has many uncommitted HUD edits] → Implement on top of current files; do not revert unrelated changes.

## Open Questions

- None blocking. If the user wants Log/stats at bottom-right instead, only decision 4 changes.

## Revision

User feedback after first implementation: Log stays at the top-left; every other control (settings, view presets, game menu, connection badge) goes to the bottom-left corner beside the hand, overriding decision 4's "Log in the cluster". Portrait phones keep the column above the raised hand to avoid overlapping it.
