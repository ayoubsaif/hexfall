## ADDED Requirements

### Requirement: No actions while the dice roll
While a dice throw is playing on the board, the client SHALL NOT let the viewer take any game action: roll, build, buy, play or reveal cards, trade, answer offers, discard, move the robber, pick a board target or end the turn, by pointer, keyboard or hotkey. Actions SHALL become available as soon as the dice rest, or when the throw's fallback timeout ends. A roll shown at rest (from a snapshot, or under reduced motion) SHALL NOT block anything.

#### Scenario: Own roll
- **WHEN** the viewer rolls and the dice are still tumbling
- **THEN** End turn and the build buttons are disabled until the dice rest

#### Scenario: Resume
- **WHEN** the viewer reconnects after a roll
- **THEN** no action is blocked by the dice
