## ADDED Requirements

### Requirement: Avatars in saved games
A stored seat SHALL keep its avatar id. A saved game stored without avatars SHALL load with each seat given the catalog avatar of its index, skipping ids already used so they stay unique. Resuming SHALL restore each seat's avatar to all clients.

#### Scenario: Resume keeps avatars
- **WHEN** a player resumes a game where seat 2 had picked an avatar
- **THEN** seat 2 still shows that avatar

#### Scenario: Old save
- **WHEN** a game saved before avatars existed is resumed
- **THEN** every seat has a distinct default avatar and the game works unchanged
