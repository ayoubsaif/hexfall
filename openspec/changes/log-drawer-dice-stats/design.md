## Context

`GameHud` (`apps/client/src/hud/Hud.tsx`) renders the event log two ways:
- below `lg` (1024 px) or on short screens: a "Log" button at the top-left opens a Radix `Sheet` (right side) holding `<EventLog />`;
- on desktop: an `<aside>` card pinned at the right (`w-[min(300px,28vw)]`), always visible.

`useHudLayout` measures that `<aside>` and passes it to `hudLayout` (`store/dock.ts`), which docks the dice tray left of the side log on desktop and otherwise left of the floating buttons above the hand. The player panels reserve `desktop:right-[400px]` for the corner controls in the desktop top bar.

The full redacted log is in `useGameStore((s) => s.log)` (snapshot log plus every update's events), so it survives reconnects. Turn rolls are `{ type: "diceRolled"; seat; dice; total }`; setup order rolls are a separate `orderRolled` event. Dice values are public: no server or protocol change is needed.

The `hud-presentation` and `game-hud` requirements being modified live in still-unarchived changes (`floating-hud-turn-timer`, `client-3d`, `dice-tray-3d`). Those changes must be archived before this one, so the MODIFIED blocks apply cleanly.

## Goals / Non-Goals

**Goals:**
- One way to reach the log on every screen size: the toggle + drawer.
- Tabs inside the drawer: "Log" and "Dice".
- A simple, readable bar chart of totals 2–12 for this game.
- Free the desktop board space the side log used.

**Non-Goals:**
- Per-player roll stats, per-turn history, expected-vs-actual comparison or probability overlays (possible follow-up).
- Production or resource statistics.
- Changing the drawer side, the toggle look, or the log line wording.
- Any engine, protocol or server change.

## Decisions

1. **Drawer in every layout.** Remove the `<aside>` and the `{!logOpen && <EventLog />}` double-mount. Drop the `hidden … max-lg:inline-flex short:inline-flex` classes on the toggle so it shows everywhere. Give the player-panel container the `pt-11` top padding in every layout (small screens already had it), so the toggle never covers a panel. Keep `desktop:right-[400px]`: it reserves room for the corner controls and connection badge in the desktop top bar, not for the side log.
   - *Alternative*: keep the side log and add a toggle to collapse it. Rejected: user asked for the small-screen behavior everywhere, and it keeps two code paths.

2. **Dice dock without the aside.** Remove `aside` from `useHudLayout` and from `hudLayout`'s input; the dock always uses the existing non-desktop branch (left of the buttons, above the hand). Keep `hudLayout` pure and update its unit tests. `--hud-bottom` (and `HudLayout.hudBottom`) only placed the side log, so both are removed.

3. **Tabs component: `@radix-ui/react-tabs`, wrapped as `components/ui/tabs.tsx`.** Same Radix family already used for dialog/sheet/tooltip; gives roving focus, arrow keys and `aria-controls`/`aria-labelledby` for free. Styled in the shadcn style used by the other `ui/` files.
   - *Alternative*: hand-rolled two-button tablist. Rejected: re-implements keyboard and ARIA behavior for no gain.

4. **Remembered tab in the UI store.** Add `logTab: "log" | "dice"` (default `"log"`) to `store/ui.ts`, so the drawer reopens on the last tab within the session. Not persisted to storage.

5. **Pure counting helper.** `game/diceStats.ts` exports `diceCounts(log: GameEvent[]): { counts: Record<2..12, number>; total: number }`, counting only `diceRolled` events by `total`. The component uses it via `useMemo` on `log`. Unit-testable without React.

6. **Chart: plain HTML/CSS bars, no chart library.** Eleven flex columns; bar height = `count / max * 100%` (0 when max is 0); count label above each bar, total label (2…12) below. Bar color: neutral HUD accent; total 7 uses the `--warn`/warning token the dice tray uses for 7. Each column has an accessible label ("8: rolled 2 times") and the chart is wrapped in a `role="img"`-free list (`<ol>`) so screen readers read it as text. Header line: "N rolls".
   - *Alternative*: Recharts or another chart lib. Rejected: ~100 kB for 11 bars, and harder to theme with HUD tokens.

7. **Drawer content mount.** `EventLog` keeps its stick-to-bottom logic. Radix `Tabs.Content` unmounts inactive panels by default, so switching back to "Log" re-runs the layout effect and lands on the newest entry — matches the spec.

## Risks / Trade-offs

- [Desktop players lose the always-visible log] → toasts still cover key events; the toggle is one click. This is the requested behavior.
- [Toggle at top-left could collide with player panels on desktop] → apply the `pt-11` offset on desktop too; covered by the existing no-overlap layout tests.
- [Spec deltas depend on unarchived changes] → archive `client-3d`, `dice-tray-3d`, `floating-hud-turn-timer` first; noted in tasks.
- [Long games make the tallest bar dominate] → heights are relative to the max, and exact counts are always printed, so small differences stay readable.

## Migration Plan

Client-only UI change; ships with the next client deploy. Rollback is reverting the commit. No stored data changes.

## Open Questions

- Should the chart also show the expected share per total (e.g. a faint marker at 6/36 for 7)? Left out to keep it simple; easy to add later.
