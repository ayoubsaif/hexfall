## 1. Shared contracts (lead)

- [x] 1.1 Re-export `COSTS` and `RESOURCES` from `@hexfall/engine/geometry` (design decision 8). Verify with an engine test that geometry exports them, and that `pnpm run check` still passes the client import rule.
- [x] 1.2 Write the stores with their final shapes: `store/room.ts`, `store/game.ts` (version, view, legal, log, inFlight, last write source) and `store/ui.ts` (chosen build, victim choice, dialog, toasts). Each gets a reset helper. Verify with `test/store/stores.test.ts`: the initial state, the reset helpers, and that the ui store clears intent on a phase or turn change.
- [x] 1.3 Implement `game/colors.ts` (seat colors and names) and the pure `game/pick.ts` `currentPick(view, legal, ui)` from design decision 3. Verify with `test/game/pick.test.ts`, using views made with the engine's `makeState` + `playerView` in tests only: the setup settlement and road picks, no pick for non-active seats, robber hexes, Road Building roads, paid builds only while chosen, and a cleared build when its legal list is empty.

## 2. Network session (net agent)

- [x] 2.1 Extend `net/connection.ts` so that close code 4001 sets status `"replaced"` and stops reconnecting, and add `restart()` (close, then reopen at once, without backoff). Verify with fake-socket tests in `test/net/connection.test.ts`.
- [x] 2.2 Implement `net/seatStorage.ts` (seats per room plus the last room, try/catch with a memory fallback, malformed data dropped) and `net/address.ts` (read and write `?room=`, case-insensitive, invite link). Verify with unit tests, including storage that throws.
- [x] 2.3 Implement `net/session.ts` (design decision 7):
  - resume on `welcome`
  - route `roomJoined`, `roomLeft`, `roomState`, `gameSnapshot`, `gameUpdate`, `actionRejected` and `error` into the stores, with the version and log-length rules
  - the intents `create`, `join`, `leave`, `start` and `act`, with the in-flight lock and its 10 s safety timeout
  - log-gap recovery through `restart()`
  - forget the seat on `bad_token` or `room_not_found`
  - "back to start" after game over

  Wire it through `bindStore.ts` and `useConnection.ts`. Verify with `test/net/session.test.ts` against a fake connection. Cover:
  - each spec scenario in `client-session`
  - an old update is ignored
  - a gap triggers a restart
  - a double send is blocked
  - a stale token is forgotten
  - a reload resumes from the address

## 3. Board (board agent)

- [x] 3.1 Add a pure piece-layout function (roads, settlements and cities with position, rotation, color and stable keys) and target-layout functions (vertex discs, edge boxes and hex areas at land height for both relief modes). Verify with tests in `test/scene/`.
- [x] 3.2 Implement `scene/Pieces.tsx` and `scene/Targets.tsx`:
  - highlights only for `currentPick` targets, with hover emphasis
  - a drag over 6 px is not a pick
  - send through `session.act()`
  - choosing a robber hex follows the victim rules (none or one victim sends at once; several victims set `ui` for the victim dialog)

  Switch `Scene.tsx` between the preview and the live board. Verify with the pure-layout tests and a manual check in Flat and 3D.
- [ ] 3.3 Implement `scene/motion.ts`:
  - a reactive `useReducedMotion()`
  - the piece drop (300 ms)
  - the robber tween (450 ms)
  - the production glow
  - no animation for snapshot writes

  Verify with unit tests of the timing and snapshot logic, plus a manual check with reduced motion turned on.

## 4. HUD (HUD agent)

- [x] 4.1 Implement the pure HUD logic:
  - `game/status.ts`: the waiting-for text and control enablement from `legal`
  - `game/cards.ts`: hand totals, and checks for discard, Year of Plenty (bank-limited) and maritime (count × rate, bank stock)
  - `game/describe.ts`: a log line for every `GameEvent` variant, redacted wording, and `toastFor`

  Verify with `test/game/*.test.ts`, including a test that runs over every `GameEvent` type.
- [x] 4.2 Implement `StartScreen` and `Lobby` (create, join, the prefilled invite code, name checks, inline server errors, seat list with presence and host mark, host start controls, leave) and `ReplacedNotice`. Verify with happy-dom component tests for the spec scenarios in `client-session`.
- [x] 4.3 Implement `PlayerPanels`, `Hand`, `TurnBar` (status, roll for order, roll, end turn, dice with reveal), `BuildBar` (costs, build picks with Cancel, buy card) and `DevCards` (play and reveal VP). Verify with component tests: an opponent's hand stays hidden, controls follow `legal`, a card bought this turn is marked, and cards cannot be played twice in a turn.
- [x] 4.4 Implement the dialogs and panels: `DiscardDialog`, `YearOfPlentyDialog`, `MonopolyDialog`, `VictimDialog` and `MaritimePanel`. Verify with component tests: the exact discard count gates Confirm, Year of Plenty is limited by the bank, the victim list shows hand sizes, harbor rates are shown and short resources are blocked, and each sends the right action.
- [x] 4.5 Implement `EventLog` (sticky scroll), `Toasts`, the `Rejection` message and `GameOver` (winner, final VP, back to start). Verify with component tests: a private steal reads without the resource, a "Your turn" toast appears, a rejection shows plain text, and back to start calls the session.

## 5. Integration (lead)

- [x] 5.1 Assemble `Hud.tsx` as the layout shell (desktop and narrow layouts, `hud/hud.css`) and wire `App.tsx`. Merge with any `aurora-background` edits in `style.css`. Verify that `pnpm run check` and `pnpm run test` pass and the layout works at 375 px and 1440 px widths.
- [x] 5.2 Write a client integration test: drive `session.ts` with scripted v2 messages from a real engine game (`createGame` + `applyAction` + `playerView` in the test). Check that the stores, `currentPick` and the status text agree through setup, a 7 with a discard, a Knight and a maritime trade.
- [ ] 5.3 Manual end-to-end play: Docker Redis, `pnpm run dev`, 3 browser tabs. Play a full game from create to game over in both board styles. Include a reload mid-game, a server restart, a second tab taking a seat, a 7 with discards, every development card type and a maritime trade. Record any issues and fix them before closing.
- [ ] 5.4 Run `pnpm run check`, `pnpm run test`, `pnpm run build` and `node tools/check-assets.mjs`, and verify that all pass. Update `CHECKPOINT.md` with the client-3d status and how to play locally.
