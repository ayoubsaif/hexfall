## ADDED Requirements

### Requirement: Timeout resolution
The engine SHALL accept a system-only `timeout` action that carries no seat and resolves whatever the game is currently waiting for. It SHALL do this by applying the same rules as the equivalent player actions, and it SHALL make every random choice with the seeded RNG stored in the state. It SHALL first append a `timedOut` event naming the phase and the seats acted for, then append the normal events of the moves it makes. The resolution SHALL be:
- **roll for order:** roll for every contender who has not rolled yet;
- **setup:**
  - if the active player still owes a settlement, place one on an intersection chosen uniformly among the legal ones, then a road chosen uniformly among the legal paths touching it;
  - if they owe only the road, place just the road;
- **main turn before the roll:** roll the dice for the active player;
- **main turn after the roll:** end the active player's turn, which cancels any open trade offers as ending a turn normally does;
- **discard after a 7:** every seat that still owes a discard discards the owed number of cards, each card picked uniformly from the cards left in that seat's hand;
- **moving the robber:** move it to a hex chosen uniformly among the legal hexes, and steal from a victim chosen uniformly among the qualifying opponents, or from no one if none qualify;
- **Road Building:** place the remaining free roads one at a time, each on a path chosen uniformly among the legal ones, stopping early when none is legal.

A `timeout` in a finished game SHALL fail with `game_over`. Players SHALL NOT be able to submit `timeout`, and `timeout` SHALL never appear in any seat's legal moves. The resolution SHALL respect every rule a player's own move would, including the Distance Rule, the piece limits and the bank limits. It SHALL trigger the same follow-ups: production, discards, Longest Road, and victory checked on the active player's turn.

#### Scenario: Timeout before the roll rolls the dice
- **WHEN** a `timeout` is applied in the main turn before the active player has rolled
- **THEN** the log shows `timedOut` followed by a dice roll for the active player, with production applied as for a normal roll

#### Scenario: Timeout after the roll ends the turn
- **WHEN** a `timeout` is applied after the active player rolled and has one open trade offer
- **THEN** the offer is cancelled and the next seat clockwise becomes active, before rolling

#### Scenario: Timeout on a 7 resolves discards for all who owe
- **WHEN** seats 1 and 2 owe 4 and 5 cards after a 7 and a `timeout` is applied
- **THEN** seat 1 loses exactly 4 cards and seat 2 exactly 5, the discarded cards go to the bank, and the game moves to the robber move

#### Scenario: Timeout moves the robber legally
- **WHEN** a `timeout` is applied while the active player must move the robber
- **THEN** the robber ends on a different hex and, if any opponent has a building on that hex, one of them loses one card to the active player

#### Scenario: Timeout in setup places a legal settlement and road
- **WHEN** a `timeout` is applied while the active player owes a setup settlement
- **THEN** a settlement obeying the Distance Rule and a road touching it are placed for them, and play passes on as in normal setup

#### Scenario: Deterministic replay
- **WHEN** the same game is replayed from its seed and action list, including its `timeout` actions
- **THEN** every timeout makes the same choices and the final states are deep-equal

#### Scenario: Never offered to players
- **WHEN** legal moves are listed for any seat in any phase
- **THEN** `timeout` is not among them
