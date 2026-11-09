## Purpose

Give every other player a build-only window after each turn in 5–6 player games, as the 5–6 player extension rules require, so players are not idle through long rounds.

## ADDED Requirements

### Requirement: Special Building Phase after each turn

In games with 5 or 6 players, when the active player ends their turn, the game SHALL enter a Special Building Phase before the next turn starts. Each other player SHALL get one building window in clockwise order, starting with the player to the left of the player who just ended. Only the player whose window it is SHALL be able to act. When the last window closes, the player to the left of the player who ended SHALL start their normal turn. Games with 3 or 4 players SHALL have no Special Building Phase.

#### Scenario: Window order in a 5-player game
- **WHEN** seat 2 ends their turn in a 5-player game
- **THEN** seats 3, 4, 0 and 1 get a building window in that order, and then seat 3 starts their turn

#### Scenario: No phase with four players
- **WHEN** seat 1 ends their turn in a 4-player game
- **THEN** seat 2's turn starts immediately

### Requirement: Allowed actions in a building window

During their window a player SHALL be able to build roads, settlements and cities and buy development cards, any number of times, following all normal building rules, costs, piece limits and bank rules, and then pass. They SHALL NOT trade with players, trade with the bank, play development cards, or reveal VP cards. Any such action SHALL fail with `not_allowed_in_special_build`. A development card bought in a window SHALL count as bought before that player's next turn, so it SHALL be playable during that next turn.

#### Scenario: Build in a window
- **WHEN** seat 3 holds brick and lumber in their window and builds a legal road
- **THEN** the road is placed, the cards go to the bank and Longest Road is recomputed

#### Scenario: Trading is refused
- **WHEN** a player in their window offers a maritime trade
- **THEN** the action fails with `not_allowed_in_special_build`

#### Scenario: Card bought in a window is playable next turn
- **WHEN** seat 4 buys a Knight in their window and their own turn later starts
- **THEN** seat 4 can play that Knight during that turn

### Requirement: Victory during the phase

A player SHALL NOT win during a Special Building Phase, even if a build brings them to the victory target. If they still have at least the target when their own turn starts, they SHALL win then, as for any player who reaches the target on another player's turn.

#### Scenario: Reaching the target in a window
- **WHEN** seat 0 builds a city in their window that brings them to the target
- **THEN** the game continues, and seat 0 wins when their own turn starts if they still have the target

### Requirement: Building windows are timed and logged

Each building window SHALL be logged (window opened, builds, purchases, pass). When the room has a turn timer, each window SHALL get its own countdown, and a window that times out SHALL be passed with nothing built. Disconnected or bot seats SHALL be handled like any other wait: a bot decides for itself, and a disconnected human's window times out.

#### Scenario: Window times out
- **WHEN** the room has a turn timer and seat 1 does nothing in their window until the countdown ends
- **THEN** seat 1's window passes with nothing built and the next window opens

#### Scenario: Log entries
- **WHEN** seat 3 builds a settlement in their window and passes
- **THEN** the log shows seat 3's building window, the settlement, and the pass
