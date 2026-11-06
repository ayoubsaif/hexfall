## MODIFIED Requirements

### Requirement: Persistence and recovery
Redis SHALL be the source of truth. An accepted action SHALL be persisted before any player receives its result. If persisting fails or Redis is down, the action SHALL be refused with `unavailable` and the game state SHALL stay as it was. The same SHALL apply to creating, joining, leaving, starting, pausing, resuming and ending early. After a server restart, a room SHALL be rebuilt on first use from its stored snapshot and the actions stored after it, and SHALL equal the state before the restart, including whether it is paused and, for a paused room, the countdown time that was left, and for a room ended early, its result. A room SHALL expire after 14 days without any change, except a paused room, which SHALL expire 7 days after it was paused, and a room ended early, which SHALL expire 1 day after it was ended.

#### Scenario: Restart mid-game
- **WHEN** the server restarts after 40 actions and a player resumes
- **THEN** their view equals the view they had before the restart, and the next action applies normally

#### Scenario: Redis down
- **WHEN** Redis is unreachable and the active player rolls
- **THEN** the roll is refused with `unavailable` and no one receives an update

#### Scenario: Restart while paused
- **WHEN** the host pauses with 25 s left on a roll wait, the server restarts, and the host later resumes
- **THEN** the room is still paused after the restart, and on resume the roll countdown shows 25 s remaining

#### Scenario: Restart after early end
- **WHEN** the host ends the game early, the server restarts, and a player resumes
- **THEN** the room is `ended` with the same result and actions are refused with `game_over`
