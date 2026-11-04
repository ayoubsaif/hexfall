## MODIFIED Requirements

### Requirement: Turn status and controls
The HUD SHALL always say what the game is waiting for and from whom, in plain words. The waits are:
- rolling for order;
- placing a setup settlement or road;
- rolling;
- discarding (listing who still owes cards);
- moving the robber;
- placing free roads;
- the active player's main turn.

This status SHALL be a small floating text pill with no surrounding panel.

The turn controls SHALL be round floating icon buttons, with no surrounding panel or card: End turn, Build road, Build settlement, Build city, Buy development card, and Trade with bank. Each button SHALL have a recognizable icon, an accessible name naming the action, and a tooltip naming the action. For build and buy buttons, the tooltip SHALL also show the cost as small resource cards. The Build road, Build settlement and Build city buttons SHALL each show, as a badge, how many of that piece the viewer has left.

Visibility and enabling:
- End turn SHALL be visible only while it is the viewer's turn, and enabled only while `endTurn` is legal.
- The build, buy and bank-trade buttons SHALL NOT be shown at all while it is not the viewer's turn, nor during roll for order or setup.
- On the viewer's own main turn, each of those buttons SHALL be shown, and enabled only when its legal move is present: `buildRoad`, `buildSettlement` or `buildCity` non-empty, `buyDevCard`, or `maritime`.

The Roll dice and Roll for order controls SHALL be the dice tray itself (see "Dice display"). A Build button SHALL start the matching board pick and offer Cancel.

#### Scenario: Before the roll
- **WHEN** it is the viewer's turn and they have not rolled
- **THEN** the dice tray is enabled as "Roll dice", and the End turn and build buttons are visible but disabled

#### Scenario: Waiting on another player
- **WHEN** seat 2 is active in the main turn
- **THEN** the status pill says it is seat 2's turn, the dice tray is disabled, and no End turn, build, buy or bank-trade button is shown to the viewer

#### Scenario: Roll for order
- **WHEN** the viewer's legal moves include `rollForOrder`
- **THEN** the dice tray is enabled as "Roll for order", and activating it sends `rollForOrder` once

#### Scenario: Floating icon buttons
- **WHEN** the viewer has rolled on their own turn and can afford a road
- **THEN** a round road icon button with no panel around it is enabled, its accessible name is "Build road", its tooltip shows a brick and a lumber card, and its badge shows the roads they have left

#### Scenario: No turn bar or build panel
- **WHEN** the game HUD is shown in any phase
- **THEN** no boxed turn bar or build panel is shown, and no Roll dice or Roll for order button exists besides the dice tray

### Requirement: Own hand
The HUD SHALL show the viewer's resource counts per type and the development cards they hold, marking cards bought this turn as not yet playable. Their remaining roads, settlements and cities SHALL be shown on the build buttons (see "Turn status and controls"). When the viewer holds no development cards, no development-card area, placeholder or empty-state text SHALL be shown.

#### Scenario: Card bought this turn
- **WHEN** the viewer bought a Knight this turn
- **THEN** the Knight is shown in hand, marked as playable from next turn

#### Scenario: No development cards
- **WHEN** the viewer holds no development cards
- **THEN** only the resource cards are shown in the hand, with no development-card panel or "No development cards" text

### Requirement: Dice display
The HUD SHALL show two dice and their total in a dice tray, docked at the bottom-right of the board area. The docked tray SHALL NOT overlap the player panels, the event log, the hand, the floating buttons or the corner controls in any layout. During the your-turn focus (see "Your-turn focus"), the tray SHALL instead be shown enlarged at the center of the screen, above the overlay.

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
- **THEN** the dice tray sits at the bottom-right of the board area, left of the event log and above the floating buttons, and overlaps neither them nor the hand

## ADDED Requirements

### Requirement: Your-turn focus
When the viewer's legal moves first include `rollDice` or `rollForOrder` after being without them, the HUD SHALL show the your-turn focus. Its elements are:
- a full-screen translucent overlay that dims the board and the rest of the HUD;
- the dice tray enlarged at the center, above the overlay;
- a "Your turn" heading (or "Roll for order");
- the roll countdown, when the room has a timer.

The focus SHALL be announced assertively to screen readers. While the browser tab is hidden, the page title SHALL be prefixed with a your-turn marker, removed when the tab becomes visible.

The focus SHALL close when any of these happens:
- the dice come to rest after the viewer's roll;
- the roll is made for them by the timer;
- the viewer dismisses it by Escape, by clicking the overlay outside the dice, or with a "Not yet" control.

While the focus is open, the viewer's playable development cards SHALL stay above the overlay and remain playable, so a Knight can be played before rolling. After a dismissal the dice return to their dock, still highlighted and still the Roll dice control. Keyboard focus SHALL move to the dice when the focus opens, and SHALL return to where it was when it closes.

#### Scenario: Turn starts
- **WHEN** the previous player ends their turn and the viewer becomes active before rolling
- **THEN** the screen dims, the dice appear enlarged at the center with "Your turn" and the countdown, and keyboard focus is on the dice

#### Scenario: Roll from the focus
- **WHEN** the viewer taps the centered dice
- **THEN** `rollDice` is sent once, the throw plays at the center, and once the dice rest the overlay fades and the dice return to their dock showing the result

#### Scenario: Knight before the roll
- **WHEN** the focus is open and the viewer holds a playable Knight
- **THEN** the Knight card is above the overlay and playing it starts the robber move

#### Scenario: Dismiss to look at the board
- **WHEN** the viewer presses Escape during the focus
- **THEN** the overlay closes, the dice return to the dock, and the dice tray is still enabled as "Roll dice"

#### Scenario: Background tab
- **WHEN** the viewer's turn starts while their tab is hidden
- **THEN** the page title starts with the your-turn marker until the tab is shown again

### Requirement: Turn countdown
When the game view carries a countdown, the HUD SHALL show the time left. The display depends on the wait:
- **viewer's own roll:** on the dice;
- **viewer's own main turn after the roll:** as a ring around the End turn button;
- **viewer owes a discard, a robber move or free roads:** in that dialog or pick prompt;
- **another seat being waited for:** on that seat's player panel.

The time left SHALL be computed from the remaining milliseconds in the latest message and the local time it arrived, never from a server timestamp. It SHALL update at most once per second, without continuous animation, and switch to the warning color in the last 10 seconds. It SHALL be available as text, for example "38 seconds left", announced politely only at 10 seconds left. When the countdown is null, no countdown SHALL be shown.

In the lobby, the host's start controls SHALL offer the timer preset (Off, Standard 30 s / 90 s, Relaxed 60 s / 120 s), with Standard preselected, and SHALL send it with the start.

#### Scenario: Countdown on End turn
- **WHEN** the viewer has rolled on their turn with a standard timer and 45 s remain
- **THEN** the End turn button shows a ring half full and its accessible description says "45 seconds left"

#### Scenario: Waiting on an opponent
- **WHEN** seat 3 owes a discard with 20 s left
- **THEN** seat 3's player panel shows 20 s for every other viewer

#### Scenario: Last seconds
- **WHEN** 10 s remain on the viewer's own countdown
- **THEN** the countdown turns to the warning color and "10 seconds left" is announced once

#### Scenario: Timer off
- **WHEN** the game's countdown is null
- **THEN** no countdown is shown anywhere in the HUD

#### Scenario: Host picks a timer
- **WHEN** the host selects Relaxed and starts the game
- **THEN** the start sends the `relaxed` preset and the first roll-for-order countdown shows 60 s
