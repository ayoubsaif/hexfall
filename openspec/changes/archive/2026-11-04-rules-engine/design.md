## Context

`packages/engine` has the seeded sfc32 RNG (`rng.ts`), the frozen board graph (`topology.ts`) and the board setups (`board.ts`). `GameState` is only `{ rng }`. The engine must stay pure: no runtime dependencies, no `Math.random`, no `Date` (`tools/check-engine.mjs`). AGENTS.md is the rules source; the spec (`specs/rules-engine/spec.md`) restates it as testable requirements.

## Goals / Non-Goals

**Goals:**
- One reducer that the server can call for every action, with typed errors and replayable results.
- Legal-move generation and validation share the same predicates, so the UI can never be offered a move that `applyAction` rejects.

**Non-Goals:**
- Wire format for actions (`game-server` wraps these types in protocol messages).
- AI players, undo, time limits.

## Decisions

### 1. Plain mutable-shaped JSON state, clone then mutate

`applyAction` does `structuredClone(state)`, runs the handler on the copy, and returns the copy. Handlers mutate the draft directly, which keeps rule code short. The input is never touched (pinned by a test that deep-freezes the input). *Alternative*: immutable spread updates everywhere. Rejected as noisy for nested hands and boards. *Alternative*: an immer-style library. Rejected: no runtime dependencies.

### 2. State shape (`state.ts`)

- `board: Board` (static after creation), `robber: HexId`.
- `vertices: (Building | null)[54]` with `Building = { owner: Seat, kind: "settlement" | "city" }`; `edges: (Seat | null)[72]`.
- `bank: Record<Resource, number>`; `devDeck: DevCard[]` (top = last element).
- `players[]`: `resources`, `devCards` (hand, in purchase order), `boughtThisTurn` (cards bought this turn, by type), `knights` (played), `revealedVp`, `pieces: { roads, settlements, cities }` left in supply.
- `turn: { seat, number, rolled, devPlayed, dice }`.
- `phase`: a tagged union: `rollForOrder` → `setup` → `play` (with sub-steps `discard`, `moveRobber`, `roadBuilding`) → `ended`.
- `longestRoad: Seat | null`, `largestArmy: Seat | null`, `offers: TradeOffer[]`, `nextOfferId`, `winner: Seat | null`, `log: GameEvent[]`.
- Seats are `0..playerCount-1`. "Clockwise" means increasing seat index.

### 3. Errors

Handlers throw a `RuleError(code, message)`; `applyAction` catches only `RuleError` and returns `{ ok: false, code, message }`. Other exceptions are engine bugs and propagate. Codes are a closed string union (`not_your_turn`, `wrong_phase`, `illegal_placement`, `insufficient_resources`, `no_pieces`, …).

### 4. One predicate set for validation and legal moves

Each rule module exports pure query functions (for example `legalRoadEdges(state, seat)`). Handlers validate by membership in those lists, and `legalActions` assembles the same lists. Validation never has its own copy of a rule.

### 5. RNG draw order (replay contract)

`createGame`: the variable board (if any), then the development deck shuffle. During play, draws happen only for dice (two `nextInt(6)` calls, die 1 first), roll-for-order dice, and steals (`nextInt(victimHandSize)` over the victim's hand expanded in fixed resource order brick, grain, lumber, ore, wool). A pinned test locks a seeded game's dice and deck.

### 6. Rule interpretations (where AGENTS.md leaves a choice)

- **Victory reveal.** Hidden VP cards count only when revealed. Public VP ≥ 10 on the active player's turn ends the game automatically. When public + hidden ≥ 10, the player must send `revealVictoryPoints` (legal only then), which reveals all held VP cards and wins. This keeps the "only to win" rule literal instead of auto-revealing.
- **Pending win at turn start.** When `endTurn` passes the turn, the new active player is checked at once. A player who reached 10 public VP during another turn wins at the start of their own turn.
- **Steal victim.** Victims are the opponents with a building next to the robber's new hex, even if their hand is empty (then nothing is stolen). `victim` is required whenever at least one candidate exists, and must be `null` otherwise.
- **Road Building** may be played with fewer than 2 roads in supply. It grants `min(2, roads left)` free placements. The phase ends early when no legal path is left.
- **Year of Plenty** takes exactly `min(2, cards in bank)` cards, and the bank must hold every requested card.
- **Trade offers.** Any seat may propose while the turn is in play after the roll. An offer from the active player names the opponents who may accept. An offer from a non-active player must be addressed to the active player only (anything else is `invalid_trade`). The proposer must hold the offered cards when proposing. Accepting checks both hands at that moment. Counter-offers are new offers. All open offers are cleared when the turn ends, and an offer is removed when its proposer cancels it, when it is accepted, or when every addressee has rejected it.
- **Trading and building need the roll.** Trades, builds and purchases are legal only after the roll. Development cards may be played before it.
- **Beginner setup.** Beginner mode uses the §4c setup phase (no Illustration A). `startingPlayer` may be given in either mode (AGENTS.md §4a allows a user-chosen start). Without it, players roll for the start.

### 7. Longest Road

DFS from every owned road edge, extending through an intersection only if it is empty or owned by the player, with a per-edge visited set. Lengths are recomputed for all players after every road or settlement placement. The award rule: let `M` be the maximum length. If the holder has `M` and `M ≥ 5`, the holder keeps it. Otherwise, a unique player with `M ≥ 5` takes it, and with no unique player it is set aside. At most 15 edges per player makes brute force cheap.

### 8. Views and logs

`playerView(state, seat | null)` (`null` = spectator) strips `rng` and `devDeck` (keeps its length), reduces other players' `resources` and `devCards` to counts, and redacts log events: `devCardBought.card` and `steal.resource` stay only for the parties involved. The view is a separate plain type, `PlayerView`.

### 9. Module layout and ownership (parallel implementation)

| Module | Contents | Owner |
|---|---|---|
| `state.ts`, `rules/errors.ts`, `rules/common.ts`, `game.ts` | types, errors, costs and VP helpers, `createGame`, `applyAction` dispatch, turn end, victory, `legalActions` | lead |
| `rules/placement.ts`, `rules/longestRoad.ts` | building legality and handlers, Longest Road | board agent |
| `rules/setup.ts`, `rules/production.ts`, `rules/robber.ts` | roll for order, setup snake, dice and production, discard and robber | flow agent |
| `rules/devCards.ts`, `rules/trade.ts`, `rules/largestArmy.ts`, `view.ts` | development cards, trading and harbors, Largest Army, redacted view | cards agent |

The lead writes types and stub signatures first, so agents code against fixed contracts and own disjoint files (including their own test files).

## Risks / Trade-offs

- [`structuredClone` per action is O(state)] → The state is a few KB plus the log. If the log grows large, the server can trim it from the hot state later.
- [Explicit VP reveal lets a player miss a win] → The legal-move list flags `revealVictoryPoints` and the UI should prompt. This matches the physical game.
- [Rule interpretations in decision 6 differ from some apps] → Each is pinned by a scenario in the spec, so changing one is a visible spec change.
