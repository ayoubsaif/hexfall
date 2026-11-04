## 0. Prerequisites

- [x] 0.1 Archive `client-3d`, then `hud-tailwind-cards`, then `dice-tray-3d` (or confirm with the owner that this change may be applied first and archived after them). Verify: `openspec/specs/game-hud` and `openspec/specs/hud-presentation` exist, or the owner's go-ahead is noted in CHECKPOINT.md.

## 1. Engine: `timeout` action

- [x] 1.1 Add `{ type: "timeout" }` to `Action` and `timedOut { phase: PhaseKind; seats: Seat[] }` to `GameEvent` in `state.ts`. Dispatch `timeout` in `applyAction` before the seat checks; it returns `game_over` in the `ended` phase. Make sure `legalActions` never lists it. Verify: `vp check` passes in `packages/engine`; a test asserts `game_over` on an ended game; the fuzz test still passes.
- [x] 1.2 Implement `rules/timeout.ts` for roll for order, the turn before the roll (roll) and the turn after the roll (end turn, cancelling offers), reusing the existing rule functions. Verify with unit tests:
  - the spec scenarios "Timeout before the roll", "Timeout after the roll ends the turn";
  - roll for order with one seat already rolled;
  - a timeout end-turn that makes the next player win at the start of their turn.
- [x] 1.3 Add timeout resolution for discard (uniform card-by-card draw from the RNG), move robber (uniform hex, uniform victim) and Road Building (uniform legal path, stopping when none is left). Verify with unit tests:
  - the "7 resolves discards" and "moves the robber legally" scenarios;
  - Road Building with 1 road left in supply;
  - Longest Road recomputed after auto-roads.
- [x] 1.4 Add setup resolution: a uniform legal settlement and then a uniform legal road touching it, or just the road if only the road is owed. Verify with tests: the Distance Rule holds, the second-settlement starting resources are granted, and the snake order continues.
- [x] 1.5 Determinism and fuzz. Verify:
  - a test replays a seeded game containing timeouts in every phase twice and gets deep-equal states;
  - the fuzz test injects `timeout` with a 10% chance per step and still conserves cards and pieces and reaches a winner.

## 2. Protocol v3

- [x] 2.1 Bump `PROTOCOL_VERSION` to 3. Add `turnTimer: z.enum(["off","standard","relaxed"]).optional()` to `startGame`, and `timer: { kind, durationMs, remainingMs, seats } | null` to `gameSnapshot` and `gameUpdate`. Export a `TURN_TIMER_PRESETS` table (roll/action ms). Verify: protocol tests round-trip both messages, and a test asserts that `{type:"timeout"}` fails `ClientActionSchema`.

## 3. Server: turn timer

- [x] 3.1 Add `turnTimer` and `startedAt` to `RoomMeta`, and `at` to stored action records, in the memory and Redis stores. Old records load with the timer `off` and no `at`. Verify: the store contract tests pass for both stores, including loading a fixture written without the new fields.
- [x] 3.2 Add pure helpers: `waitKind(state)`, `waitingSeats(state)`, `restartsTimer(before, action, after)`, and `deadlineOf(loaded, preset)`, which replays the anchors. Verify: unit tests cover the "Acting restarts" and "Other players cannot extend the turn" scenarios, a discard by an owing seat, and the ended phase returning null.
- [x] 3.3 Refactor `Room.act()` into `act()` + `commit(action, at)`. Add `arm()`/`fire()` with the version guard, and inject `now`/`setTimer`/`clearTimer` through `RoomDeps` (defaults: `Date.now`, `setTimeout`). Arm after start, after every commit and after `fromLoaded`. Clear on delete and evict. Retry after 5 s on `unavailable`. Verify with fake-scheduler tests:
  - the "Auto-roll" and "Idle turn ends" scenarios;
  - "Race with a player's action";
  - "Timer off";
  - a store outage during a timeout retries and then succeeds.
- [x] 3.4 Accept `turnTimer` in `startGame` and include `timer` (with `remainingMs` computed at send time) in every snapshot and update. Verify:
  - "Start with a timer" (first view has a 30 s roll countdown);
  - updates carry the remaining time after the fake clock advances;
  - the game-over update carries `timer: null`.
- [x] 3.5 Restart behavior. Verify: a real-Redis test (`TEST_REDIS=1`) starts a `standard` game, advances the clock 10 s, drops the room from memory, advances 20 s, resumes, and sees about 60 s remaining. A second case with the deadline already passed fires exactly one timeout on resume.
- [x] 3.6 Update the e2e test: a 3-client `standard` game where one client goes silent sees its roll, end-turn and discard handled by timeouts, and the game continues. Verify: `pnpm --filter server test` passes (with and without `TEST_REDIS=1`).

## 4. Client: state and countdown

- [x] 4.1 Store `timer` and `timerAt` (`performance.now()`) from snapshots and updates in `store/game.ts` / `net/bindStore.ts`. Add `hud/countdown.ts` with `useCountdown()`, which ticks on whole seconds and returns `secondsLeft`, `fraction`, `warning` (≤ 10 s), `kind` and `seats`. Verify with fake-timer unit tests:
  - it updates once per second;
  - the warning appears at 10 s;
  - null in gives null out;
  - a new message resets it.
- [x] 4.2 Add a "time ran out" line for the `timedOut` event in `game/describe.ts` (log and toast). Verify: a describe test produces "Time ran out for Ana: dice rolled automatically" (or similar wording for each phase).
- [x] 4.3 Add the turn-timer picker to `Lobby.tsx`: radio Off / Standard / Relaxed, Standard preselected, remembered in `localStorage` `hexfall.turnTimer` (wrapped in try/catch), and sent with `startGame`. Verify: an RTL test selects Relaxed, starts the game, and asserts the sent payload.

## 5. Client: floating controls and edge hand

- [x] 5.1 Build `hud/actions/Fab.tsx`: round icon button, badge, optional stepped SVG countdown ring, tooltip, 40 × 40 minimum on mobile. Verify: RTL tests cover the accessible name, the badge text, the ring `stroke-dashoffset` at fraction 0.5, and that no transition style is on the ring.
- [x] 5.2 Build `hud/actions/ActionButtons.tsx` (road, settlement, city, dev card, bank trade, End turn) with cost-card tooltips and piece badges. Add `showBuildControls()` to `game/status.ts`. Delete `TurnBar.tsx` and `BuildBar.tsx`, moving `costText`/`costCards` here. Verify: tests for the scenarios "Before the roll", "Waiting on another player" (no build/End turn buttons in the DOM), "Floating icon buttons" and "No turn bar or build panel".
- [x] 5.3 Add `hud/StatusPill.tsx` with the turn status text and the build-pick prompt with Cancel. Verify: the existing `turn-status` tests pass against the pill; picking a build shows "Pick a spot on the board" and Cancel clears it.
- [x] 5.4 Add `GameCard` `layout="peek"`: name strip at the top, icon in the upper half, badge at the top right. Verify: a GameCard test checks DOM order and classes for peek vs default; the dialogs still render the default layout.
- [x] 5.5 Rewrite `Hand.tsx` as the edge hand (resource slots plus dev-card slots only when held, the half-off-edge translate, hover/focus rise, a radial shadow element, `--overlap` when narrow). Strip the `Card` wrapper and empty text from `DevCards.tsx`. Verify with RTL tests:
  - "No development cards" (no dev group, no text);
  - "First development card bought";
  - resource cards are focusable and named "Brick, 3".
- [x] 5.6 Rework `Hud.tsx` `GameHud` and `useHudLayout`: hand at the bottom center, FAB cluster at the bottom-right, status pill above the hand, `--hud-bottom` for the side log, dice dock above or left of the FAB cluster. Verify: the dock unit test is updated; screenshots at 360 × 740, 768 × 1024, 900 × 500 and 1440 × 900 show no overlaps and no horizontal scroll, with the hand peeking at the edge.

## 6. Client: your-turn focus and countdown display

- [x] 6.1 Add `ui.focus` ("closed" | "open" | "dismissed") and `useTurnFocus()`, which opens on the legal roll going false → true and resets when the roll leaves the legal set. Verify: unit tests for open on turn start, open on a resume snapshot, no reopen after dismiss within the same wait.
- [x] 6.2 Build `hud/TurnFocus.tsx`:
  - the overlay, heading and countdown, and "Not yet";
  - Escape or a backdrop click dismisses;
  - an alert announcement and the `document.title` marker while hidden;
  - focus moves to the dice and back on close.

  Verify: RTL tests for "Turn starts", "Dismiss to look at the board" and "Background tab" (mock `document.hidden` and `visibilitychange`).
- [x] 6.3 Add the centered mode to `DiceTray` (fixed center, `--die` 88/64 px, a 200 ms translate/scale transition, `motion-reduce:transition-none`) and an `onSettled` callback that closes the focus. Raise playable dev cards to `z-40` while the focus is open. Verify: RTL tests for "Roll from the focus" (sends once; settles; closes; dock position restored) and "Knight before the roll" (the Knight is clickable while the overlay is open).
- [x] 6.4 Show the countdown in each place it belongs:
  - the dice (own roll), and the End turn ring (own turn after the roll);
  - the discard dialog, the robber pick prompt and the Road Building prompt;
  - the waited-on seats' player panels;
  - the 10 s polite announcement.

  Verify: the RTL scenarios "Countdown on End turn", "Waiting on an opponent", "Last seconds" and "Timer off".

## 7. Motion, styling and verification

- [x] 7.1 Put the new transitions (hand rise, overlay fade, dice move) under the `.hud` reduced-motion rule in `style.css`, with nothing looping. Verify: in the running client `document.getAnimations()` shows no infinite iterations, every transition is ≤ 200 ms (except the throw), and with reduced motion forced the overlay and dice appear instantly.
- [x] 7.2 Run `pnpm run check`, `pnpm run test` and `pnpm run build`, plus `node tools/check-engine.mjs` and `node tools/check-assets.mjs`. Verify: all pass, apart from the already recorded `docs/art/minimal/build.mjs` format failure, if it is still present.
- [ ] 7.3 Manual play: 3 browser clients on a `standard` timer game. Let one player idle through a roll, a turn, a 7 discard and a robber move. Verify: each wait resolves at the deadline, the log shows "time ran out", every client's countdown matches within 1 s, and the your-turn focus opens and closes correctly. Record a GIF of the focus and roll.
- [ ] 7.4 Owner review: desktop and phone screenshots of the floating buttons, the edge hand (with and without dev cards), the your-turn focus and the countdown ring. Verify: the owner approves, or their feedback is applied.
- [x] 7.5 Update `CHECKPOINT.md` with a `floating-hud-turn-timer` section covering the timer presets, the `timeout` action, protocol v3, the deadline anchor in action records, the new HUD layout and the archive order. Verify: the section exists and names each item.
