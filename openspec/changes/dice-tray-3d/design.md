## Context

- **The dice today** (`hud/TurnBar.tsx`): two flat 28 px pip grids, a total, and the Roll dice / Roll for order / End turn buttons, all in one Card. The roll shown comes from `latestRoll(view.log)` (`game/status.ts`), which returns the newest `diceRolled` / `orderRolled` of the current turn with its log index.
- **Snapshot or update**: `store/game.ts` records how the latest state arrived in `source` (`"snapshot" | "update"`) and keeps `lastEvents`. The board's piece motion already uses this rule: no animation on snapshots.
- **Free board area** (`store/dock.ts`, from `hud-tailwind-cards`): `Hud.tsx` measures what the panels, bottom stack and side log cover. The camera fits the board into the rest. The dice tray anchors to the bottom-right corner of that area.
- **Reference pen** (jico, "3D Dice with CSS", MIT as public CodePen work):
  - a `preserve-3d` cube of six faces at `translateZ(size/2)`;
  - pips drawn with one `::after` dot plus `box-shadow` copies;
  - colors: faces `#f6f3f0`, red `#f63330`, dark `#131210`; radius 20 % of the edge;
  - an ellipse shadow blurred with `filter: blur`;
  - the throw is a `rotate3d(1,1,1,720deg)` tumble (0.7 s) plus a bounce of decaying `margin-top` hops (1 s).
- **Motion rules** (`hud-presentation`): HUD CSS only, nothing looping, everything off under reduced motion. `useCountChange.prefersReducedMotion()` already exists.

## Goals / Non-Goals

**Goals:**
- Dice that read as physical Parchís dice at 32–44 px, and are crisp at any DPR, so no bitmaps.
- One throw per roll for every player. The throw is deterministic (it doesn't depend on timing) and always ends on the server's faces.
- The tray is a single, accessible roll control.

**Non-Goals:**
- Physics or a WebGL dice scene. The dice stay in the DOM HUD, not in the R3F board.
- Predicting the result before the server answers. No fake pre-roll that later snaps to the result.
- Themes for the dice (colors per board theme). One look, tokenized so a theme can come later.
- Sound.

## Decisions

### 1. Pure CSS 3D cube component (`hud/dice/Die3d.tsx`)

Six face elements sit in a `transform-style: preserve-3d` box with edge `--die` (44 px desktop, 36 px compact):
- each face is at `rotate…() translateZ(calc(var(--die) / 2))`;
- the faces follow a real die: opposite faces sum to 7, with 1 front, 2 top, 3 right, 4 left, 5 bottom and 6 back;
- pips are absolutely positioned dots on a 3 × 3 grid, as real elements rather than the pen's `box-shadow` trick, because percentage-based grid placement scales with `--die` and is easier to test.
- The colors become tokens in `style.css`: `--color-die` `#f6f3f0`, `--color-die-rim` (lighter), `--color-pip` `#131210`, `--color-pip-red` `#f63330`.
- 1 and 4 use red pips, and the 1 pip is about 2× the others' size, as in the pen.
- A hidden inner plate (the pen's `::before` at `translateZ(-1px)`) stops faces showing through at the rounded corners.

*Alternative*: render the dice in the R3F scene. Rejected: it couples the HUD control to the canvas, adds lighting and picking work, and the pen look is pure CSS anyway.

### 2. Orientation table instead of `rotate3d` magic numbers

The pen tilts the cube with hand-tuned `rotate3d` axes per face. We instead keep a table `FACE_ROTATION[v] = {x, y}` that brings face v to the front, composed with one fixed tilt (`rotateX(-18deg) rotateY(24deg)`) so the top and right faces show for depth. This is unit-testable: for each v, applying the rotation to v's face normal must yield +Z. Exported as a pure function `restTransform(v)`.

### 3. Throw = CSS keyframes ending on the rest transform

On a new roll the die element is re-keyed (the same pattern as `useCountChange`) and gets `animate-dice-throw`:
- **Tumble** (on the cube, 800 ms, `cubic-bezier(.2,.7,.3,1)`): it runs from `var(--rest) rotateX(720deg) rotateY(360deg)` to `var(--rest)`. Full turns don't change the end orientation, so it always lands on the right face.
- **Bounce** (on the wrapper, 900 ms, linear): `translate` hops of 70 %, 25 % and 8 % of `--die`, plus the shadow scaling with height, like the pen's `throwDice`. It uses the `translate` property, as Tailwind v4 does.
- The second die starts 80 ms later for a natural feel. The total is under 1 s, within the 1.2 s cap.
- The total and the announcement appear when `animationend` fires on the second die. Under reduced motion or a snapshot they appear at once.

A hook `useDiceThrow(roll)` decides `animate | static`:
- it animates only when `roll.index` changed and the store's `source === "update"`;
- it never animates when `prefersReducedMotion()` is true.

*Alternative*: JS-driven animation (Web Animations API). Not needed; CSS keyframes keep the motion off the main thread and are trivially disabled by the reduced-motion rule.

### 4. The tray is one `<button>`

`DiceTray` renders a `<button>` around both dice. Its accessible name is:
- "Roll dice" when `controls.rollDice` is legal;
- "Roll for order" when `controls.rollForOrder` is legal;
- otherwise the button is disabled and named after the last roll ("Rolled 3 and 4, total 7", or "No roll yet this turn").

The roll text is also in an `aria-live="polite"` span that updates after the dice settle. While a roll is legal the tray gets a static `ring-2 ring-wait` and a slight lift. There is no pulsing. Clicking calls `act()` once. The existing `useInFlight` disables it until the server answers, which covers the double-click scenario. `controlsOf()` keeps computing `rollDice` and `rollForOrder`. Only `TurnBar` stops rendering those buttons.

### 5. Placement from the dice dock

`DiceTray` is mounted in `GameHud` as an absolutely positioned element at `right: dock.right` and `bottom: dock.bottom`, read from `useDockStore`. `Hud.tsx` sets the dock to 12 px left of the side log (or of the stack column on short wide screens) and 12 px above the bottom stack.
- **Desktop**: above the stack, left of the log.
- **Tablet and phone**: above the stack, at the right edge.
- **Landscape**: the bottom-right of the board column, left of the tray column. The `bottom: 0` inset puts it at the screen bottom, where the corner controls sit only on the left.

The tray needs no extra measuring, because it follows the store.

The board is a full-screen background that is never resized around the HUD (owner decision), so the tray floats over the board like the other HUD panels. Its position lives in `useDockStore` (`store/dock.ts`), which `Hud.tsx` updates from the measured stack and side log. On wider layouts the island's hexagonal corners leave sea at the bottom-right corner, so no reservation is needed. The screenshots verify this.

### 6. Turn bar

`TurnBar` keeps the status line and End turn. `Dice` and the roll buttons move into `hud/dice/`. The old `Die` pip grid is deleted.

## Risks / Trade-offs

- [Safari `preserve-3d` with `overflow`/`filter` on ancestors flattens the cube] → No `overflow`, `filter` or `backdrop-filter` on the tray or its ancestors inside the HUD root. The shadow uses a radial gradient instead of the pen's `filter: blur`. Check in WebKit (Playwright) during verification.
- [The tray covers a legal target near the board's bottom-right edge] → The compact reservation (decision 5), plus a screenshot check at all four sizes with targets shown. The tray is small (≈ 110 × 56 px).
- [Users miss the Roll button now that it's gone from the turn bar] → The status line already says "Roll the dice". The tray is highlighted while a roll is legal and has a "Roll dice" tooltip. Owner review covers this.
- [A 1 s animation delays the visible total] → Production toasts and the log aren't held back. Only the total waits for the dice to settle.
- [Rapid successive rolls (roll for order ties)] → Re-keying on `roll.index` restarts the throw cleanly, and the earlier throw is simply replaced.

## Migration Plan

Client-only. The roll buttons disappear from the turn bar in the same release as the tray appears. To roll back, revert the change; no state or protocol is involved.
