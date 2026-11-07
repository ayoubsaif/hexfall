## ADDED Requirements

### Requirement: Bot pacing
While at least one human is connected, the server SHALL wait at least 2 seconds before each bot move and at least 3 seconds before a bot starts its turn. Right after any action that rolled dice (a turn roll, a roll for order, or a roll made by the turn timer), the next bot move SHALL wait for the full dice throw plus 1 second. With nobody connected, bots MAY move without these delays.

#### Scenario: Bot after a roll
- **WHEN** a player rolls the dice and a bot moves next
- **THEN** the bot does not move until the dice throw has finished and 1 more second has passed

#### Scenario: Readable bot turn
- **WHEN** a bot builds twice in its turn while a human watches
- **THEN** at least 2 seconds pass between the two builds
