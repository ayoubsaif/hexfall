## Why

The board exists as data, but nothing can be played yet: there is no game state, no turn flow, and no rule checks. The server (`game-server`) and the client need one authoritative, deterministic rules engine to host real games. This change adds the full base-game rules from AGENTS.md §4c–§13.

## What Changes

- **Game state.** A plain-JSON `GameState`. It holds the board, robber, buildings and roads, the finite bank (19 per resource), the shuffled 25-card development deck, per-player hands, piece supplies, played Knights, the special cards, the turn and phase, and an event log. All randomness (board, deck shuffle, dice, steals, roll-for-order) comes from the seeded RNG kept inside the state.
- **Game creation.** `createGame({ seed, playerCount: 3 | 4, mode: "beginner" | "variable", startingPlayer? })`. Beginner mode uses the §4a board. Variable mode generates the §4b board. Both then run the §4c setup phase. With no `startingPlayer`, players roll for the start (ties re-roll).
- **Action reducer.** `applyAction(state, action)` returns either the next state plus the new events, or a typed rule error. It never mutates its input. The actions are: roll for order, setup placements, roll dice, discard, move robber and steal, build road / settlement / city, buy and play development cards, reveal VP cards, domestic trade offers (propose / accept / reject / cancel), maritime trade, and end turn.
- **Rules.** Setup snake order and starting resources; production with the robber block and the bank-shortage rule; the full 7 sequence (discard >7, mandatory robber move, random steal); placement legality (Distance Rule, connectivity blocked by opponents, piece limits); one development card per turn and no playing cards bought this turn; Knight, Road Building, Year of Plenty, Monopoly and VP cards; Longest Road with breaks, ties and the set-aside state; Largest Army; harbors and 4:1 / 3:1 / 2:1 rates; and 10-VP victory only on the active player's own turn.
- **Legal-move generation.** `legalActions(state, seat)` lists what a seat may do right now: road paths, settlement spots, city targets, purchases, playable cards, robber hexes with victims, discard obligations, maritime rates and so on.
- **Information hiding.** `playerView(state, seat)` returns a redacted view. Opponents' hands are reduced to counts, unrevealed development cards are hidden, the deck order and RNG state are removed, and log events are redacted (steals name the card only to thief and victim).

Out of scope:
- Rooms, persistence, the network protocol for actions, and the client UI (`game-server`, `client-3d`, `trading`).
- The strict separate trade/build phase toggle (AGENTS.md §5 says it is optional; the combined phase is the default).
- The "fully random tokens" board option and beginner pre-placed pieces (already excluded in `board-topology`).

## Capabilities

### New Capabilities
- `rules-engine`: the deterministic game state machine. It covers game creation, the setup phase, turns, production, robber, building, development cards, special cards, trading, victory, legal-move generation, the event log and per-player redacted views.

### Modified Capabilities

(none)

## Impact

- `packages/engine`: new `state.ts` types and new `rules/*` modules, re-exported from `index.ts`, plus one test suite per rule area. `GameState` and `makeState` change shape (internal only; nothing outside the engine uses them yet).
- No new dependencies. The engine stays pure (`tools/check-engine.mjs`).
- No client, server or protocol changes.
