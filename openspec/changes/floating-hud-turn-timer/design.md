## Context

See proposal.md for the motivation. Current state:

- **HUD** (`apps/client/src/hud/Hud.tsx`): `GameHud` renders a bottom "stack" of four shadcn `Card`s: `TurnBar` (status and End turn), `BuildBar` (build/buy/trade buttons with cost cards), `Hand` (resource cards and pieces left) and `DevCards` (shows "No development cards." when empty). `useHudLayout` measures the stack to place the side log (`--hud-stack`) and the dice dock (`store/dock.ts`).
- **Dice tray** (`hud/dice/DiceTray.tsx`, change `dice-tray-3d`): a single button positioned from the dock store. The throw animation is driven by `useDiceThrow`.
- **Cards** (`hud/cards/GameCard.tsx`): a portrait card with the name strip along the bottom, the dev-card icon centered, and the count badge at the top right.
- **Server** (`apps/server/src/rooms/room.ts`): `Room.act()` serializes actions through `run()`, applies them with `applyAction`, appends them with `store.appendAction(code, expectedVersion, action, snapshot?)`, then sends each seat a `gameUpdate`. Rooms are rebuilt by replaying from the snapshot. The game-server spec currently forbids acting on a player's behalf.
- **Engine:** every `Action` carries a `seat`. `ClientActionSchema` in `packages/protocol/src/game.ts` is an explicit list, so a new engine action is not client-sendable unless it is added there.
- **Archive order:** `game-hud` and `hud-presentation` live in the unarchived changes `client-3d`, `hud-tailwind-cards` and `dice-tray-3d`. The deltas here are written against the `dice-tray-3d` versions.

## Goals / Non-Goals

**Goals:**
- Server-authoritative timer that survives restarts and replays deterministically.
- One code path for player actions and timeouts, covering persistence, broadcast and the end-of-game status.
- A HUD with no boxed panels, where every control stays reachable on a 360 px phone.

**Non-Goals:**
- Sound or system notifications for "your turn". There is no audio asset pipeline and notifications need a permission prompt. Only the title marker and the screen-reader announcement are in scope.
- Per-seat or custom timer lengths, pausing the timer, and "kick idle player".
- Keeping a room loaded in memory while nobody is connected (see Risks).
- Timeouts for domestic trade responses. Offers die with the turn as they do today.

## Decisions

### 1. `timeout` is an engine action, not a server-side move picker
The engine gains `{ type: "timeout" }` (no seat) and a `timedOut { phase, seats }` event. Resolution lives in a new `rules/timeout.ts`, which reuses the existing rule functions (`rollDice`, `discard`, `moveRobber`, placement, `endTurn`) and draws every choice from the state RNG.

- **Why:** replay stays "seed + action list". The server only stores `{type:"timeout"}`, and the random choices are reproduced by the engine. Fuzz tests and determinism tests cover it for free.
- **Alternative:** the server picks a concrete legal action (for example a random `moveRobber`) with `Math.random` and stores that. This was rejected because it puts rules knowledge (what to do in each phase) in the server and needs a second RNG. It would replay correctly only because the concrete action is stored, and engine tests could not cover it.
- **Seat handling:** `applyAction` dispatches `timeout` before the generic seat checks. `legalActions` never emits it. `SeatlessAction` in the protocol already drops seat-less members. `ClientActionSchema` is left unchanged, and a protocol test asserts that `{type:"timeout"}` fails to decode.
- **Uniform choices** use the existing `rng` helpers. A random discard draws one card at a time, weighted by the remaining hand, so each card is equally likely.
- **Setup:** one timeout places both the settlement and its road, so the player does not wait out two deadlines for a single placement step.

### 2. Deadline anchor derived from action timestamps
Stored action records gain `at` (server ms). The deadline is not stored separately: it is computed from (a) the `at` of the last action that restarted the timer, or the game start time, and (b) the duration for the current wait kind.

- A pure helper, `timerFor(stateBefore, action, stateAfter, preset)`, decides whether an action restarts the timer:
  - the phase or the active player changed; or
  - the actor was waited-on (the active seat, or a seat in `discard.owed`).
- `waitKind(state)` returns `roll` for `rollForOrder` and for a turn not yet rolled, `action` for every other running phase, and `null` for `ended`.
- **Why:** the anchor is written atomically with the action that set it (same `appendAction` call), so there is no extra Redis write and no meta/action race. Rebuilding replays the actions and recomputes the anchor exactly.
- **Alternative:** store `deadline` in `RoomMeta` and update it after every action. That doubles the writes per action, and a crash between the two writes leaves the deadline and the state out of step.
- `RoomMeta` gains `turnTimer: "off" | "standard" | "relaxed"` (absent means `off`) and `startedAt`. Older stored rooms and records without `at` load as timer `off`, or with the anchor set to load time.

### 3. One commit path, version-guarded timer
`Room.act()` is split into `act()`, which handles seat lookup and validation, and a private `commit(action, at)`. `commit` applies the action, appends it, updates `state`/`version`, handles the ended meta, broadcasts, and finally calls `arm()`.

`arm()` clears any previous handle and, when a deadline exists, sets `setTimeout(fire, max(0, deadline - now))`, remembering `armedVersion = this.version`. `fire()` queues through `run()` and returns immediately if `this.version !== armedVersion` or the room is deleted/stale. Otherwise it commits `{type:"timeout"}` with `at = now`.

- **Why:** the per-room queue already serializes operations. The version check makes "player acts at the same moment the timer fires" safe without locks.
- **Testing:** the clock (`now`) and the timer functions are injected through `RoomDeps` (the service already takes `now`), so server tests use a fake scheduler instead of real time.
- `arm()` is also called after `fromLoaded` (rebuild) and after `startGame`. Deleting or evicting a room clears its handle.
- **Store failure:** if `commit` fails on the timeout (`unavailable`), `arm()` retries after 5 s rather than dropping the turn.

### 4. Countdown on the wire as "remaining at send time"
`gameSnapshot` and `gameUpdate` gain `timer: { kind: "roll" | "action", durationMs, remainingMs, seats } | null`. `remainingMs` is computed as `deadline - now()` when each message is built. The client stores it with `performance.now()` at receipt, and `useCountdown()` derives the seconds left.

- **Why:** this avoids clock skew between server and client. Latency makes the client show slightly more time than the server will allow (by one RTT, usually under 200 ms), which is acceptable.
- **Alternative:** send an absolute deadline and correct it with the ping offset. That is more moving parts for no visible gain.
- **Protocol:** `PROTOCOL_VERSION` becomes 3 (field shape changes), and `startGame` gains an optional `turnTimer`.

### 5. Client: countdown hook ticking once per second
`net/bindStore.ts` stores `timer` and `timerAt` in the game store. `hud/countdown.ts` provides `useCountdown()`, which returns `{ secondsLeft, fraction, warning, kind, seats } | null`.

- It ticks with a `setTimeout` aligned to the next whole second, so the display changes at most once per second and nothing animates in between.
- The 10-second announcement is a polite live region that is filled once when `secondsLeft` crosses 10.

### 6. Floating action buttons
`TurnBar.tsx` and `BuildBar.tsx` are deleted. New `hud/actions/`:
- `Fab.tsx`: a round 48 px button (44 px on compact screens), `bg-hud` with a blur and shadow. It takes an icon, a badge and an optional countdown ring. The ring is an SVG circle whose `stroke-dashoffset` is set per tick, with no CSS transition.
- `ActionButtons.tsx`: the cluster. Icons from `lucide-react`:

  | Action | Icon |
  |---|---|
  | road | `Route` |
  | settlement | `House` |
  | city | `Castle` |
  | development card | `Layers` |
  | bank trade | `Landmark` |
  | End turn | `SkipForward` |

  End turn is the primary-colored, larger FAB at the end of the cluster. The tooltip content reuses `costCards()` and `CostCards` from the old BuildBar, moved into this file. The piece badges come from `own.pieces`.
- **Visibility:** a `showBuildControls(view, seat)` helper in `game/status.ts` returns true only when the viewer is the active player after setup has ended (phases `turn`, `discard`, `moveRobber`, `roadBuilding`), and false during roll for order, setup, the game's end and other players' turns. It keeps the logic unit-testable.
- The "Pick a spot on the board. Cancel" prompt moves into the status pill while a build pick is active.

### 7. Edge hand with a peek layout
`Hand.tsx` renders one `<div role="group" aria-label="Your hand">` fixed at the bottom center, holding resource slots and then (only if any are held) the dev-card slots from `DevCards.tsx`. `DevCards` keeps its logic (`groupCards`, `blockedReason`, `play`) but loses its `Card` wrapper and empty text.

- Each slot is translated down by 50% of the card height. `:hover`/`:focus-within` sets `translate-y-0` (200 ms, `motion-reduce:transition-none`).
- Non-interactive resource cards get `tabIndex=0` so keyboard users can raise them. They still expose "Brick, 3".
- `GameCard` gains `layout="peek"`. It moves the name strip to the top, puts the dev icon in the upper half, and keeps the count badge at the top right, so everything identifying stays visible while half the card is hidden.
- The shadow is one blurred radial-gradient element behind the row, sized to the row. It is not a `filter` on an ancestor, which keeps the dice tray's 3D rule intact.
- **Overflow:** when the row is wider than the viewport minus the FAB cluster, the slots get a negative margin computed in CSS (`--overlap`) from the card count, so they overlap instead of wrapping. The hovered or focused card is raised with `z-10`.

### 8. Your-turn focus
New `hud/TurnFocus.tsx`:

- **Trigger:** `useTurnFocus()` watches `legal.rollDice || legal.rollForOrder` going from false to true (including the first view after a resume), and sets `ui.focus = "open"`.
- **Overlay:** `fixed inset-0 z-30 bg-black/55`, fading in over 200 ms. It holds the heading, the countdown and a "Not yet" link button. Escape, a click on the backdrop, or "Not yet" sets `focus = "dismissed"`.
- **Dice:** `DiceTray` reads `ui.focus`. When it is open, the tray renders `fixed left-1/2 top-1/2 z-40` with `--die: 88px` (64 px on mobile), moving via `translate`/`scale` with a 200 ms transition. Otherwise it uses the dock position. Because the same element moves, its throw state and focus survive.
- **Closing:** a new `onSettled` callback from `DiceTray` (fired by the existing `settledKey` logic) closes the focus when a roll by or for the viewer lands. A timer-driven roll closes it the same way.
- **Dev cards:** the playable dev-card slots get `z-40` while the focus is open.
- **Keyboard focus:** it moves to the dice button when the overlay opens, and back to the previously focused element when it closes.
- **Announcement:** a `role="alert"` region says "Your turn".
- **Background tab:** while `document.hidden`, `document.title` gets the `● ` prefix, removed on `visibilitychange`.

### 9. Layout measurement
`useHudLayout` now measures the FAB cluster and the side log instead of the stack.

- **Dice dock:** right equals the side log's left edge (or 12 px), and bottom equals the FAB cluster's top plus 12 px. On mobile the dice sit left of the FAB cluster, above the hand peek.
- `--hud-stack` is replaced by `--hud-bottom`, the height of the hand peek and the cluster, which places the side log's bottom.
- The status pill floats above the hand row.

### 10. Lobby picker
`Lobby.tsx` adds a three-option radio group (Off / Standard 30 s · 90 s / Relaxed 60 s · 120 s), with Standard preselected, next to the board-mode choice. The choice is saved to `localStorage` (`hexfall.turnTimer`) for the host's next game and sent in `startGame`.

## Risks / Trade-offs

- **[Rooms with nobody connected are evicted, so their timer stops]** → On the next load (any resume), `arm()` finds the deadline already passed and fires once immediately. The new anchor is that timeout's `at`, so there is no cascade of catch-up timeouts. The game effectively pauses while everyone is away, which is acceptable.
- **[Random auto-placement in setup can be very bad for the player]** → This is intended as a penalty for idling. The log line makes clear that time ran out.
- **[Client countdown can lag the server by the latency]** → The client may show "1 s" when the server fires. This is acceptable; the server is authoritative.
- **[Overlapping hand cards on small phones hide counts]** → The count badge sits at the top right and remains visible; overlap is limited so at least 40 % of each card shows. The accessible names are unaffected.
- **[The overlay could trap players who want to inspect the board before rolling]** → Escape, a backdrop click or "Not yet" dismisses it. The board is also visible, dimmed, behind it.
- **[Removing the boxed panels breaks existing HUD tests]** → Tests move to roles and names ("End turn", "Build road", "Your hand"), not structure. Task 5 lists them.
- **[`timeout` interacting with victory]** → It reuses `endTurn` and `rollDice`, so the "wins at the start of their own turn" rule and the hidden-VP checks already apply. Engine tests cover a timeout end-turn that makes the next player win.

## Migration Plan

1. The engine change is additive. Old action logs replay unchanged.
2. Protocol v3: old clients get the existing version-mismatch "please reload" banner.
3. Stored rooms with no `turnTimer` in their meta behave as `off`, and action records without `at` use the load time as the anchor.
4. **Rollback:** reverting the server makes rooms that contain `timeout` actions fail to replay (`ReplayError`). Only roll back before any timed game has been played, or flush those rooms.
