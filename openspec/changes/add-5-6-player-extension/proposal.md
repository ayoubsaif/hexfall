## Why

Hexfall only seats 3–4 players on the 19-hex island, so larger groups can't play together. The 5–6 player extension rules (bigger island, more components, a Special Building Phase so waiting players stay involved) are the standard answer. Groups also want shorter or longer games, which a selectable victory-point target gives them.

## What Changes

- New **5–6 player game mode** following the 5–6 player extension rules:
  - **Large board**: 30 land hexes in a 3-4-5-6-5-4-3 layout (6 forest, 6 pasture, 6 fields, 5 hills, 5 mountains, 2 deserts), its own sea frame and **11 harbor slots** (5 generic 3:1, 2 wool 2:1, one 2:1 each for brick, grain, lumber, ore).
  - **28 number tokens**: two each of 2 and 12, three each of 3, 4, 5, 6, 8, 9, 10, 11; placed randomly with no two red numbers (6/8) adjacent. One robber, starting on one of the two deserts.
  - **Larger bank and deck**: 24 cards of each resource (120); 34 development cards (20 Knight, 3 Road Building, 3 Year of Plenty, 3 Monopoly, 5 VP).
  - **Two more player colors** (seats 5 and 6), each with 15 roads, 5 settlements, 4 cities.
  - **Special Building Phase**: after each turn, every other player in clockwise order may build and buy development cards, but may not trade (with players or the bank) or play development cards.
  - Variable (random) setup only: no verified beginner layout exists for the large board.
- **Selectable victory-point target** for every game (3–6 players): the host picks the points needed to win in the lobby (range 8–15, default 10). Victory and VP-card reveal use this target. The target is shown in the HUD.
- Rooms hold up to **6 seats**. 3–4 seats play the standard board; 5–6 seats play the large board. The host can add bots up to 6 and the solo start offers up to 5 opponents.
- The client renders the large board (sea ring, harbors, island ground and coast, camera framing) and fits 5–6 player panels on desktop and phone.
- Bots play 5–6 player games, including Special Building Phase decisions.
- **BREAKING** (protocol): game config and room state gain `victoryTarget` and allow player counts 5–6; saved games without these fields load as before (target 10, standard board).
- AGENTS.md is updated: the 5–6 extension and the VP target option move from "not implemented" to documented rules.

## Capabilities

### New Capabilities
- `large-board`: the 30-hex board for 5–6 players — topology, harbor slots, component counts and seeded variable setup.
- `special-building-phase`: the build-only window each other player gets after a turn in 5–6 player games.

### Modified Capabilities
- `rules-engine`: game creation accepts 5–6 players with the larger bank and deck, and a victory target; victory and VP-card reveal use the target; turn structure hands off to the Special Building Phase in 5–6 player games; legal moves cover the new phase.
- `board-topology`: the board value carries which layout it uses so the standard 19-hex requirements apply to the standard layout only.
- `game-server`: rooms hold up to 6 seats; the start picks the board by seat count and takes the victory target; turn timer covers the Special Building Phase.
- `bots`: bots can fill rooms up to 6 seats, solo play allows up to 5 opponents, and bots act in the Special Building Phase.
- `board-view`: board rendering, sea frame, harbor markers and framing work for the large board; six seat colors.
- `compact-player-panels`: up to six panels fit on desktop and at 360 px width.
- `hud-top-bar`: six panels in the top row; the HUD shows the victory target and the Special Building Phase window.

## Impact

- `packages/engine`: board topology and board generation (second layout), game creation, components, phases (new Special Building Phase), victory checks, legal moves, views and tests.
- `packages/protocol`: game config, room state and start-game message schemas.
- `apps/server`: room seat limit, start validation, turn timer for the new phase, saved-game compatibility.
- `packages/bots`: build-only policy for the new phase; any 4-player assumptions.
- `apps/client`: lobby controls (VP target, seat limit), player colors 5–6, board scene (sea, coast, island ground, harbors, camera fit), HUD panels and phase status, i18n strings (en, es), rules guide.
- `AGENTS.md`: documents the extension and VP target.
