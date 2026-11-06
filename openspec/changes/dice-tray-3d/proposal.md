> **Superseded in part by `physics-dice-3d` (2026-11-06):** the CSS dice (`Die3d`, the tumble and bounce keyframes) are gone. The dice are now thrown with physics on the board. The tray keeps its placement and its role as the roll button, and shows the total.

## Why

The dice are two small flat faces squeezed into the turn bar, so the most physical moment of a turn (throwing the dice) feels like reading a label. The owner wants the dice to sit on the table at the bottom-right of the board, drawn as real 3D cubes in the style of Parchís dice (reference: https://codepen.io/jico/pen/wvMpgog), and thrown by tapping them.

## What Changes

- New **dice tray**: two CSS 3D cubes and the total, pinned to the bottom-right corner of the free board area (above the bottom stack and left of the side log; the board itself stays a full-screen background). On desktop that is just above the bottom tray and left of the side log. On landscape phones it is the bottom-right of the board column, and on phones and tablets it is just above the tray.
- **Parchís-style look**, as in the reference pen:
  - cream faces with rounded corners and a slightly lighter rim;
  - dark pips, with the single pip and the four pips in red, and the single pip drawn larger;
  - a soft blurred shadow under each die.
- **Throw animation**: on a new roll the dice tumble (two turns) and bounce to rest showing the rolled faces, in about 1 s, once per roll. Every player sees it. Snapshots (join, resume) and reduced motion show the result immediately.
- **Tap the dice to roll.** The dice tray is the roll control. It is named "Roll dice" (or "Roll for order" during the roll for order) and highlighted while that move is legal, and disabled otherwise.
- **BREAKING (UI)**: the Roll dice and Roll for order buttons are removed from the turn bar, which keeps the turn status and End turn.
- The HUD motion rule gains one exception: the dice throw may last up to 1.2 s. It still plays once per roll, never loops, and is disabled under reduced motion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `game-hud`:
  - "Dice display" changes: 3D dice in the bottom-right of the board area, the throw animation, and no animation for snapshots.
  - "Turn status and controls" changes: the dice are the Roll dice / Roll for order control, and the turn bar no longer has those buttons.
- `hud-presentation`: "Minimal motion" allows the dice throw as the only HUD animation longer than 200 ms.

Both capabilities are still in unarchived changes (`client-3d` introduces `game-hud`, `hud-tailwind-cards` introduces `hud-presentation`). Archive those two before archiving this change.

## Impact

- **Client code**:
  - `apps/client/src/hud/TurnBar.tsx`: the dice and roll buttons move out.
  - New `apps/client/src/hud/dice/` (a `Die3d` cube, `DiceTray`, throw state).
  - `hud/Hud.tsx`: mounts the tray at the dock corner.
  - `style.css`: dice tokens and keyframes.
  - `store/dock.ts`: where the tray docks, measured by `Hud.tsx`.
- **Tests**:
  - HUD tests that click "Roll dice" in the turn bar move to the dice tray.
  - New tests for face orientation, the throw/snapshot/reduced-motion rules and the accessible names.
- **No new dependencies.** The dice are plain CSS 3D transforms, with no WebGL or physics. The reference pen is MIT-licensed public CodePen work. The cubes are reimplemented, and a source comment credits the pen.
- **No engine, protocol or server changes.** Rolling still sends `rollDice` / `rollForOrder`, and results still come from the server's roll event.
