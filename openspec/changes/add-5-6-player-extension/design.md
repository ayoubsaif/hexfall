## Context

See proposal.md for motivation. Today the engine has a single frozen topology singleton `TOPOLOGY` built for an axial radius-2 island (`packages/engine/src/topology.ts:119–123, 253`), with a fixed `HARBOR_POSITIONS` table (:70). `board.ts` hardcodes the 19-hex bags, the A–R spiral and the beginner tables. `rules/common.ts` holds `BANK_PER_RESOURCE = 19` and `WIN_VP = 10` (used by `game.ts:116` and `rules/devCards.ts:82`); `game.ts` holds the 25-card `DEV_DECK` and rejects player counts other than 3–4. `GameConfig` is `{ seed, playerCount: 3 | 4, mode, startingPlayer? }`. Phases are `rollForOrder | setup | turn | discard | moveRobber | roadBuilding | ended`.

Outside the engine: protocol `Seat` is `max(3)` and `proposeTrade.to` is `max(3)`; the server has `MAX_SEATS = 4` and casts `playerCount as 3 | 4` (also in the saved-game record); the client has 4 `SEAT_COLORS` (throws past seat 3), reads `TOPOLOGY` directly in `scene/layout.ts`, `coastScatter.ts`, `forestTrees.ts`, `mountainPeaks.ts`, `pastureSheep.ts`, and fits the camera to a fixed `FIT_RADIUS = 6.3`. Bots have no player-count assumptions, but `trade.ts` `LEADER_VP` thresholds assume 10 VP.

## Goals / Non-Goals

**Goals:**
- One engine code path for both layouts: every rule reads topology, bank size and deck from the game state, not module constants.
- Old saved games and in-flight rooms keep working without migration.
- The large board reuses all existing scene features (sea, beach, coast, trees, peaks, sheep, harbors).

**Non-Goals:**
- A fixed beginner layout or pre-placed pieces for the large board.
- The lettered token spiral for the large board (see Decision 3).
- Rebalancing bot strategy for 6 players beyond scaling VP thresholds.
- New 3D assets: seats 4–5 reuse the tinted piece models.

## Decisions

### 1. Topology becomes a per-layout value, chosen by the board
`build()` is generalized to take a list of axial hexes (plus harbor positions) and return a `Topology`. Two frozen instances: `STANDARD_TOPOLOGY` (exactly today's ids) and `LARGE_TOPOLOGY`. `topologyOf(board)` / `topologyFor(layout)` replace direct `TOPOLOGY` use. `TOPOLOGY` stays exported as an alias of the standard one during the migration so client code can move file by file, and is removed in the last task.
- *Alternative*: one topology big enough for both with "disabled" hexes. Rejected: ids, coast order and harbor slots would all differ from today, breaking stored games and the standard spec.
- The corner-key derivation is already generic; only the hex list, coastal walk start (upper-left side of hex 0) and corner-hex detection (hexes with 3 land neighbors) need parameterizing. The large board's 6 corner hexes fall out of that rule.

### 2. Board value carries `layout`
`Board` gains `layout: "standard" | "large"`, optional on read (missing → standard). Hex and harbor array lengths follow the layout. This is the only data change visible in stored boards.

### 3. Large board tokens: constrained random shuffle, not a letter spiral
AGENTS.md §4b allows fully random token placement provided no 6/8 are adjacent. The large board has no hexagonal spiral (rows 3-4-5-6-5-4-3), and we have no verified copy of the extension's letter order, so we don't guess it. Tokens are shuffled with the seeded RNG and reshuffled until the red-number check passes; the expected number of retries is small and the result is still deterministic per seed.
- *Alternative*: hand-author a spiral and letters. Rejected: unverifiable against the rulebook.

### 4. Components come from a per-player-count rules profile
A `rulesProfile(playerCount)` returns `{ layout, bankPerResource, devDeck }` (19/25-card for 3–4; 24/34-card for 5–6). Game creation stores `bankPerResource` and `victoryTarget` in state; bank-shortage logic and maritime limits read the state rather than `BANK_PER_RESOURCE`. `WIN_VP` is replaced by `state.victoryTarget` everywhere (`checkVictory`, VP-card reveal, legal moves).

### 5. Special Building Phase as a new phase kind
New phase `{ kind: "specialBuild", queue: Seat[], current: Seat, afterTurnOf: Seat }`. `endTurn` in a 5–6 player game builds the queue (the other seats clockwise from the left of the ender) instead of starting the next turn. Actions allowed for `current`: `buildRoad`, `buildSettlement`, `buildCity`, `buyDevCard`, and a new `passSpecialBuild`; everything else returns `not_allowed_in_special_build`. Pass pops the queue; an empty queue starts the next turn (and runs the existing "win at start of own turn" check).
- The build rule functions are reused as-is; they currently check `phase.kind === "turn"` and `hasRolled`, so those guards are factored into a "may build now" predicate that accepts either the active player's rolled turn or the current window's seat.
- Dev cards bought in a window: the "bought this turn" mark is keyed to the turn number; a window belongs to the ending turn, so the card is playable on the buyer's next turn without special handling. Covered by a test.
- *Alternative*: model windows as mini-turns of `turn` kind with flags. Rejected: risks leaking roll/trade/card logic into windows.

### 6. Protocol and server
- `Seat` → `max(5)`, `proposeTrade.to` → `max(5)`, maritime count limit → `max(24)`.
- `StartGameMessage` gains optional `victoryTarget: int 8–15`; zod rejects others (`bad_frame`).
- New `passSpecialBuild` game action; game view gains `victoryTarget` and the new phase.
- Server `MAX_SEATS = 6`; `playerCount` type widens to `3 | 4 | 5 | 6` in room and saved-game records; a stored config without `victoryTarget` is read as 10.
- The turn timer treats each window as a wait owned by the window's seat; timeout applies `passSpecialBuild`. A shorter default window length (e.g. a third of the turn length, minimum 15 s) keeps rounds moving; exact value is a server constant.
- Avatars must stay unique per room: confirm the catalog holds at least 6 (it does if ≥ 6 entries; otherwise add).

### 7. Client
- `SEAT_COLORS` gains green and brown; key union and i18n names extended.
- Scene code takes the topology from the board in view (`topologyOf(view.board)`); `useFitCamera` computes the fit radius from the topology's sea ring extent instead of the constant 6.3. The large island is wider than tall, so landscape screens fit it naturally; on portrait screens the camera rotates the board 90° only if the fit check shows it is too small — decided during implementation by measurement, not by spec.
- `MapSketch` (19-hex lobby sketch) renders from the topology.
- Lobby: seat limit 6, victory-target select (8–15, remembered in localStorage like the turn timer), "large board" note at 5–6 seats; solo start offers 2–5 opponents.
- Player panels: with 5–6 seats below a width breakpoint, panels collapse to avatar + name + VP; details stay in the existing panel popover.
- HUD: goal chip ("Goal: N VP"); status for the building window; action bar shows build/buy/pass only during my window.
- i18n strings with hardcoded counts (`errors.ts`, `rules.ts`, `session.ts`, `tutorial.ts`) are updated in en and es; the rules guide gets a 5–6 player section.

### 8. Bots
The bot already iterates players. Add a window policy: build the best affordable item using the existing build scoring, else pass; never call trade or card actions. `LEADER_VP` thresholds become offsets from `victoryTarget`.

### 9. AGENTS.md
Add a section for the 5–6 extension (components, large board, Special Building Phase) and the victory target option, and remove those two items from §14.

## Risks / Trade-offs

- [Removing the `TOPOLOGY` singleton touches many client files] → keep an alias and migrate file by file; a final grep task removes it.
- [Special Building Phase slows rounds with 6 humans] → per-window timer and a pass button that is always visible; bots pass quickly.
- [Six panels on a 360 px phone are cramped] → collapsed panel mode; scenario tests at 360 and 390 px.
- [Wider board makes pieces smaller on phones] → camera fit from topology extent; verify by screenshots at 9:16 before closing the change.
- [Token reshuffle loop could in theory run long] → each attempt is cheap; add a test across many seeds asserting a low retry count, and cap at a large number with a deterministic fallback swap pass.
- [Protocol change with old clients] → protocol version bump; old clients get `version_mismatch` and reload (existing behavior).

## Migration Plan

No data migration: missing `layout` reads as standard and missing `victoryTarget` as 10. Deploy server and client together (protocol version bump). Rollback is a redeploy of the previous version; any 5–6 player rooms created in between would fail to load and expire normally.
