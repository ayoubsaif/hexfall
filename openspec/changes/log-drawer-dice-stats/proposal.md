## Why

On desktop the event log is a card pinned to the right side of the board. It takes about a third of the width, crowds the player panels and the dice dock, and is the only place where layouts differ in how the log is reached. Players also have no way to see how the dice have behaved this game ("has 8 come up at all?"), which is a common table-talk question in Catan.

## What Changes

- **BREAKING (layout)**: remove the always-visible side log on desktop. The log opens from the same "Log" toggle and drawer used today on mobile, tablet and short screens, in every layout.
- Add two tabs inside the log drawer:
  - **Log**: the existing event log, unchanged in content and scroll behavior.
  - **Dice**: a simple bar chart of how many times each total 2–12 has been rolled this game, counted from the `diceRolled` events in the redacted log (rolls for turn order are not counted). Shows the number of rolls in total; empty state before the first roll.
- Desktop gets the space back: the player panels and the dice dock no longer reserve room for the side log.
- New i18n strings (en, es) for the tab labels, chart title, axis labels and empty state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `game-hud`: "Event log" requirement now places the log inside a tabbed drawer; new "Dice statistics" requirement; "Dice display" placement no longer refers to a side log.
- `hud-presentation`: "Responsive HUD layout" — the log is a drawer in every layout, not only mobile/tablet/short.

## Impact

- `apps/client/src/hud/Hud.tsx`: drop the `<aside>` side log, show the Log toggle in every layout, render a tabbed panel inside the `Sheet`; adjust player-panel right offsets that reserved space for the log.
- `apps/client/src/hud/Feed.tsx`: `EventLog` stays; new `DiceStats` component (or new file `hud/DiceStats.tsx`) and a small tabs wrapper.
- `apps/client/src/game/`: new pure helper `diceCounts(log)` → counts for 2–12 (unit-tested).
- `apps/client/src/store/dock.ts` / `useHudLayout`: the `aside` measurement goes away; dice dock always uses the "left of the buttons, above the hand" placement.
- `apps/client/src/components/ui/`: new `tabs.tsx` (adds `@radix-ui/react-tabs` dependency, same family as existing Radix dialog/tooltip).
- i18n catalogs `en`/`es` (`session` or `dialogs` namespace).
- Tests: `Hud.test.tsx` (no side log on desktop, drawer has tabs), new tests for `diceCounts` and the Dice tab.
- No engine, protocol or server changes: the dice values are already public in the redacted log.
