## 0. Prerequisites

- [ ] 0.1 Confirm `client-3d`, `dice-tray-3d` and `floating-hud-turn-timer` are archived (or archive them) so the `game-hud` and `hud-presentation` MODIFIED blocks apply cleanly

## 1. Dice counting helper

- [x] 1.1 Add `apps/client/src/game/diceStats.ts` with `diceCounts(log)` returning counts for totals 2–12 and the total number of `diceRolled` events (ignores `orderRolled`)
- [x] 1.2 Unit tests in `apps/client/test/game/diceStats.test.ts`: empty log, order rolls ignored, mixed totals (8, 6, 8, 7, 11 → 8:2, 6:1, 7:1, 11:1, total 5)

## 2. Tabs primitive and UI state

- [x] 2.1 Add `@radix-ui/react-tabs` to `apps/client/package.json` (via the workspace catalog like the other Radix packages) and install
- [x] 2.2 Add `apps/client/src/components/ui/tabs.tsx` (Tabs, TabsList, TabsTrigger, TabsContent) styled like the other `ui/` components
- [x] 2.3 Add `logTab: "log" | "dice"` (default `"log"`) and a setter to `apps/client/src/store/ui.ts`

## 3. Dice statistics view

- [x] 3.1 Add `apps/client/src/hud/DiceStats.tsx`: reads `log` from the game store, `useMemo(diceCounts)`, renders "N rolls" header and 11 CSS bars (height relative to max, count above, total below, 7 in the warning color)
- [x] 3.2 Empty state when no counted roll yet
- [x] 3.3 Accessible text: chart as an ordered list, each item labelled with total and count

## 4. Log drawer in every layout

- [x] 4.1 In `Hud.tsx`, remove the desktop `<aside>` side log and the duplicate `EventLog` mount
- [x] 4.2 Show the "Log" toggle in every layout (drop the `hidden`/`max-lg:`/`short:` visibility classes)
- [x] 4.3 Put `Tabs` inside `SheetContent`: "Log" → `<EventLog />`, "Dice" → `<DiceStats />`, controlled by `logTab`
- [x] 4.4 Player panels: add desktop top padding so the toggle does not cover them (keep `desktop:right-[400px]`, which reserves the top-bar corner controls)
- [x] 4.5 Remove the `aside` measurement from `useHudLayout` and the `aside` input from `hudLayout` (`store/dock.ts`); drop `--hud-bottom` if unused; update dock tests
- [x] 4.6 Make sure the sheet content fills its height so the log list scrolls inside the tab panel

## 5. i18n

- [x] 5.1 Add en/es strings: tab labels ("Log"/"Registro", "Dice"/"Dados"), "{{count}} rolls" with plurals, empty state, per-bar accessible label
- [x] 5.2 Check the catalog completeness test passes for both locales

## 6. Tests and verification

- [x] 6.1 `Hud.test.tsx`: no side log on desktop width; toggle visible; drawer opens on "Log"; switching to "Dice" shows the chart; reopening keeps the last tab
- [x] 6.2 `DiceStats` component test: counts render, 7 bar has warning style, live update when a new `diceRolled` arrives, empty state
- [x] 6.3 Update any tests that relied on the desktop side log (`session-game` integration, layout tests)
- [x] 6.4 Run client typecheck, lint and test suite
- [ ] 6.5 Check in the browser at 1440×900, 900×500 and 360×740: toggle, drawer, tabs, chart, no overlaps, dice dock placement
