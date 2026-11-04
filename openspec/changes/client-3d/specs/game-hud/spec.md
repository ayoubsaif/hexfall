## Purpose

The in-game HUD over the board: what each player can see about the table, their own hand and cards, the controls for every non-trading move the engine allows, maritime trade, the event log, feedback on rejected moves and the end of the game.

## ADDED Requirements

### Requirement: Player panels
The HUD SHALL show one panel per seat in seat order. A panel SHALL show the seat's name, color, connected state, resource card count, development card count, played Knights, public VP, and whether the seat holds Longest Road or Largest Army. The active seat SHALL be clearly marked. The viewer's own panel SHALL also show their total VP including hidden VP cards, marked as private. The HUD SHALL NOT show any other player's hand contents or unrevealed development cards.

#### Scenario: Opponent hand stays hidden
- **WHEN** seat 1 holds 3 brick and 2 ore
- **THEN** the other players see "5 cards" on seat 1's panel and no card types

#### Scenario: Disconnected player
- **WHEN** a `roomState` shows seat 2 as disconnected
- **THEN** seat 2's panel shows a disconnected mark

### Requirement: Own hand
The HUD SHALL show the viewer's resource counts per type, their development cards in hand (marking cards bought this turn as not yet playable), and their remaining roads, settlements and cities.

#### Scenario: Card bought this turn
- **WHEN** the viewer bought a Knight this turn
- **THEN** the Knight is shown in hand, marked as playable from next turn

### Requirement: Turn status and controls
The HUD SHALL always say what the game is waiting for and from whom, in plain words: rolling for order, placing a setup settlement or road, rolling, discarding (listing who still owes cards), moving the robber, placing free roads, or the active player's main turn. Each control SHALL be shown or enabled only when the matching legal move is present: Roll for order (`rollForOrder`), Roll dice (`rollDice`), End turn (`endTurn`), Buy development card (`buyDevCard`), Build road, settlement and city (non-empty `buildRoad`, `buildSettlement`, `buildCity`). Build and buy controls SHALL show their resource cost. A Build control SHALL start the matching board pick and offer Cancel.

#### Scenario: Before the roll
- **WHEN** it is the viewer's turn and they have not rolled
- **THEN** Roll dice is enabled and End turn and the build controls are disabled

#### Scenario: Waiting on another player
- **WHEN** seat 2 is active in the main turn
- **THEN** the HUD says it is seat 2's turn and the viewer's action controls are disabled

### Requirement: Dice display
The HUD SHALL show the two dice and their total from the latest roll of the current turn, including rolls for order. A new roll SHALL get a short reveal animation, except under reduced motion.

#### Scenario: Roll shown to everyone
- **WHEN** seat 0 rolls 3 and 4
- **THEN** every player sees dice 3 and 4 with total 7

### Requirement: Discard after a 7
When the viewer's legal moves have `discard` greater than 0, the HUD SHALL open a discard picker that cannot be skipped. It SHALL let the player choose exactly that many cards from their hand by type, and SHALL enable Confirm only when the chosen count matches. Confirm SHALL send `discard` with the chosen cards. Players who do not owe cards SHALL see who is still discarding.

#### Scenario: Discard four of nine
- **WHEN** the viewer holds 9 cards after a 7 and owes 4
- **THEN** Confirm stays disabled until exactly 4 cards are chosen, then sends `discard` with them

### Requirement: Development card plays
The HUD SHALL offer only the cards listed in `playDevCard`, and Reveal VP only when `revealVictoryPoints` is true. Playing a Knight SHALL send `playKnight` and then lead into the robber pick. Road Building SHALL send `playRoadBuilding` and then lead into the free-road picks. Year of Plenty SHALL ask for the resources (two, or as many as the bank holds when it holds fewer), showing which types the bank has, and send `playYearOfPlenty`. Monopoly SHALL ask for one resource type and send `playMonopoly`. Reveal VP SHALL send `revealVictoryPoints`.

#### Scenario: Year of Plenty
- **WHEN** the viewer plays Year of Plenty and picks grain and ore
- **THEN** the client sends `playYearOfPlenty` with resources grain and ore

#### Scenario: Card not offered
- **WHEN** the viewer already played a development card this turn
- **THEN** no development card play controls are enabled

### Requirement: Maritime trade
When the viewer's legal moves include maritime rates (`maritime` is not null), the HUD SHALL offer a bank trade panel. It SHALL show the viewer's rate for each resource as the server gave it (4:1, 3:1 or 2:1). The player picks the resource to give, the resource to get (a different type), and how many to get. The panel SHALL check that the player has `count × rate` of the given resource and that the bank has `count` of the wanted resource before enabling Trade. Trade SHALL send `maritimeTrade` with give, get and count. The panel SHALL NOT offer trades with other players.

#### Scenario: Harbor rate
- **WHEN** the viewer owns the 2:1 ore harbor and holds 4 ore
- **THEN** the panel shows ore at 2:1 and allows getting up to 2 cards for ore

#### Scenario: Not enough cards
- **WHEN** the viewer holds 3 wool at a 4:1 rate
- **THEN** wool cannot be chosen as the resource to give

### Requirement: Event log
The HUD SHALL show the game's redacted event log, newest last, in plain words with seat names and colors. Each event type the engine produces SHALL have a readable line. A steal SHALL name the resource only if the event includes it. A development card purchase SHALL name the card only for its buyer. The log SHALL stay scrolled to the newest entry unless the player has scrolled up.

#### Scenario: Private steal
- **WHEN** seat 0 steals from seat 1 and the viewer is seat 2
- **THEN** the log says that seat 0 stole a card from seat 1, without the resource

#### Scenario: Production
- **WHEN** a roll pays seat 1 two grain and one ore
- **THEN** the log shows that seat 1 received 2 grain and 1 ore

### Requirement: Key-event toasts
The HUD SHALL show short toasts that close on their own for events that concern the viewer or change the standings: the viewer's turn starting, cards the viewer received or lost (production, steal, monopoly, discard), a 7 being rolled, Longest Road or Largest Army changing hands, and a bank shortage. Toasts SHALL NOT block input.

#### Scenario: Your turn
- **WHEN** a `turnStarted` event names the viewer's seat
- **THEN** a "Your turn" toast appears

### Requirement: Rejected actions
On `actionRejected`, the HUD SHALL show the rule error to the player in plain words, with the error code available. The message SHALL close on its own or be dismissible. The view SHALL stay unchanged.

#### Scenario: Rejection message
- **WHEN** the server rejects an action with `insufficient_resources`
- **THEN** the HUD shows a short message that there are not enough resources

### Requirement: Game over
When the view has a winner, the HUD SHALL show a game-over screen with the winner's name and color and every player's final VP, including the VP cards revealed at the end. All action controls SHALL be disabled. The screen SHALL offer a way back to the start screen. Since the server allows leaving only in the lobby, this SHALL forget the saved seat for that room and open a fresh connection with no seat, so the player can create or join another room.

#### Scenario: Win on own turn
- **WHEN** a `gameWon` event names seat 3 with 10 VP
- **THEN** every player sees seat 3 as the winner and the final VP of all seats
