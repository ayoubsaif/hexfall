## MODIFIED Requirements

### Requirement: Event log
The HUD SHALL show the game's redacted event log, newest last, in plain words with seat names and colors. The log SHALL be shown in the "Log" tab of the log drawer (see "Log drawer tabs"). Each event type the engine produces SHALL have a readable line. A steal SHALL name the resource only if the event includes it. A development card purchase SHALL name the card only for its buyer. The log SHALL stay scrolled to the newest entry unless the player has scrolled up.

#### Scenario: Private steal
- **WHEN** seat 0 steals from seat 1 and the viewer is seat 2
- **THEN** the log says that seat 0 stole a card from seat 1, without the resource

#### Scenario: Production
- **WHEN** a roll pays seat 1 two grain and one ore
- **THEN** the log shows that seat 1 received 2 grain and 1 ore

#### Scenario: Opened at the newest entry
- **WHEN** the viewer opens the log drawer on the "Log" tab during a game with 40 events
- **THEN** the list is scrolled to the newest entry

### Requirement: Dice display
The HUD SHALL show two dice and their total in a dice tray, docked at the bottom-right of the board area. The docked tray SHALL NOT overlap the player panels, the log toggle, the hand, the floating buttons or the corner controls in any layout. During the your-turn focus (see "Your-turn focus"), the tray SHALL instead be shown enlarged at the center of the screen, above the overlay.

Each die SHALL be drawn as a three-dimensional cube with rounded edges, showing the rolled value on its front face. The single pip and the four pips SHALL be red and the other pips dark, on cream faces, and the single pip SHALL be larger than the others. The dice SHALL show the latest roll of the current turn, including rolls for order. Before any roll in the current turn they SHALL show a resting pose with no total.

When a new roll arrives as an incremental update, every player SHALL see a single throw animation: the dice tumble and bounce, then come to rest on the rolled faces. A roll that arrives in a snapshot (join, resume) SHALL show its result without the animation, and so SHALL every roll under reduced motion. A total of 7 SHALL be shown in the warning color.

The dice tray SHALL be one control with the accessible name "Roll dice" while `rollDice` is legal, and "Roll for order" while `rollForOrder` is legal. While one of those moves is legal it SHALL be visibly highlighted, without looping animation, and activating it by pointer or keyboard SHALL send that action once. Otherwise the control SHALL be disabled. The latest roll SHALL be available as text, for example "Rolled 3 and 4, total 7", and SHALL be announced once the dice come to rest.

#### Scenario: Roll shown to everyone
- **WHEN** seat 0 rolls 3 and 4
- **THEN** every player sees the dice tumble and settle on 3 and 4, with total 7

#### Scenario: Tap to roll
- **WHEN** it is the viewer's turn before the roll and they click or press Enter on the dice tray
- **THEN** the client sends `rollDice` exactly once, and the tray stays disabled until the result arrives

#### Scenario: Resume shows the result without a throw
- **WHEN** the viewer reconnects mid-turn after a roll of 5 and 2
- **THEN** the dice show 5 and 2 immediately with no animation

#### Scenario: Reduced motion
- **WHEN** the user's system prefers reduced motion and a roll of 6 and 6 arrives
- **THEN** the dice show 6 and 6 immediately with no tumble or bounce

#### Scenario: Placement on desktop
- **WHEN** the game HUD is shown at 1440 × 900 px outside the your-turn focus
- **THEN** the dice tray sits at the bottom-right of the board area, left of the floating buttons and above the hand, and overlaps neither them nor the hand

## ADDED Requirements

### Requirement: Log drawer tabs
The log drawer SHALL contain two tabs: "Log" (the event log) and "Dice" (dice statistics). "Log" SHALL be selected the first time the drawer opens in a session; afterwards the drawer SHALL reopen on the tab last selected. The tabs SHALL be keyboard operable (arrow keys move between tabs, the selected tab's panel is labelled by its tab) and use the viewer's language.

#### Scenario: Default tab
- **WHEN** the viewer opens the log drawer for the first time
- **THEN** the "Log" tab is selected and the event log is shown

#### Scenario: Switch to dice
- **WHEN** the viewer selects the "Dice" tab
- **THEN** the dice statistics are shown in place of the event log

#### Scenario: Remembers last tab
- **WHEN** the viewer selects "Dice", closes the drawer and opens it again
- **THEN** the "Dice" tab is selected

### Requirement: Dice statistics
The "Dice" tab SHALL show a bar chart with one bar for each total from 2 to 12, in order. Each bar's height SHALL be proportional to how many times that total has been rolled this game, relative to the most frequent total, and each bar SHALL show its count as a number. Counts SHALL come from the `diceRolled` events in the redacted log; rolls for turn order (`orderRolled`) SHALL NOT be counted. The tab SHALL show the total number of rolls counted. The bar for 7 SHALL use the warning color, as the dice tray does. Before the first counted roll the tab SHALL show an empty-state message instead of bars. The counts SHALL update while the drawer is open when a new roll arrives, and SHALL be the same after a reconnect as before it. The chart SHALL be available to screen readers as text, one count per total.

#### Scenario: Counts after several rolls
- **WHEN** the log contains `diceRolled` totals 8, 6, 8, 7 and 11
- **THEN** the "Dice" tab shows count 2 for 8, 1 for 6, 7 and 11, 0 for every other total, and 5 rolls in total
- **AND** the bar for 8 is the tallest

#### Scenario: Order rolls ignored
- **WHEN** the setup roll for order produced totals 9 and 4 and no turn roll has happened yet
- **THEN** the "Dice" tab shows the empty-state message

#### Scenario: Live update
- **WHEN** the "Dice" tab is open and a roll of total 5 arrives
- **THEN** the count for 5 increases by one without reopening the drawer

#### Scenario: Reconnect keeps counts
- **WHEN** the viewer reconnects after 12 turn rolls
- **THEN** the "Dice" tab shows the same 12 rolls and per-total counts as before the reconnect
