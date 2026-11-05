## ADDED Requirements

### Requirement: Trade with players button
The floating turn controls SHALL include a **Trade with players** round icon button, placed next to **Trade with bank**, with a recognizable icon, an accessible name and a tooltip naming the action. It SHALL follow the same visibility as the other build, buy and bank-trade buttons: not shown while it is not the viewer's turn, nor during roll for order or setup. On the viewer's own main turn it SHALL be shown, and enabled only when the viewer's legal moves have `proposeTrade` true and no action is in flight. Activating it SHALL open the offer composer addressed to every opponent.

#### Scenario: Before the roll
- **WHEN** it is the viewer's turn and they have not rolled
- **THEN** the Trade with players button is visible but disabled

#### Scenario: After the roll
- **WHEN** the viewer has rolled on their own turn
- **THEN** the Trade with players button is enabled, and activating it opens the offer composer with every opponent selected as a recipient

#### Scenario: Not the viewer's turn
- **WHEN** seat 2 is active in the main turn and the viewer is seat 0
- **THEN** no Trade with players button is shown among the floating turn controls

### Requirement: Offer composer
The offer composer SHALL be a dialog where the viewer sets, for each of the five resources, how many cards they give and how many they ask for, using steppers that show the resource as a picture card. The give stepper for a resource SHALL NOT go above the number of that resource in the viewer's hand. Raising one side of a resource SHALL set the other side of that resource to zero, so a resource is never on both sides. The ask steppers SHALL NOT be limited by the opponents' hands, which the viewer cannot see.

When the viewer is the active player, the composer SHALL list every opponent as a recipient toggle, all on by default, and SHALL require at least one. When the viewer is not the active player, the only recipient SHALL be the active player and it SHALL NOT be changeable.

**Send offer** SHALL be enabled only when both sides contain at least one card, no resource is on both sides, the viewer holds every card they give, at least one recipient is chosen, `proposeTrade` is legal and no action is in flight. Sending SHALL send `proposeTrade` with the give bundle, the get bundle and the recipient seats, and SHALL close the composer. The composer SHALL show a one-line plain summary of the trade ("You give 2 Ore, you get 1 Wool"). Closing the composer SHALL send nothing.

#### Scenario: Valid offer
- **WHEN** the active viewer holds 2 ore, sets give ore to 2 and ask wool to 1, keeps seats 1 and 2 selected, and presses Send offer
- **THEN** the client sends `proposeTrade` with give `{ore: 2}`, get `{wool: 1}` and to `[1, 2]`, and the composer closes

#### Scenario: Gift blocked
- **WHEN** the viewer sets only give cards and asks for nothing
- **THEN** Send offer is disabled

#### Scenario: Same resource on both sides impossible
- **WHEN** the viewer gives 1 ore and then raises ask ore to 1
- **THEN** give ore drops to 0

#### Scenario: Cannot give more than held
- **WHEN** the viewer holds 1 brick and the give brick stepper shows 1
- **THEN** its increase control is disabled

#### Scenario: No recipient
- **WHEN** the active viewer turns off every recipient
- **THEN** Send offer is disabled

#### Scenario: Non-active viewer
- **WHEN** a non-active viewer opens the composer
- **THEN** the only recipient shown is the active player and it cannot be removed

### Requirement: Open offers tray
The HUD SHALL show a tray of open offers that involve the viewer, taken from the `offers` in the viewer's view, oldest first. It SHALL NOT be shown when there are none. Offers that neither come from nor are addressed to the viewer SHALL NOT be listed. Each entry SHALL show the proposer's name in their seat color and both sides as small resource picture cards with counts, from the viewer's point of view ("You give" / "You get"), with an accessible text equivalent.

For an offer addressed to the viewer that the viewer has not declined:
- **Accept** SHALL be shown, and enabled only when the offer id is in `legal.acceptTrade` and no action is in flight. When it is disabled because the viewer lacks the asked cards, the entry SHALL say so. Accept SHALL send `acceptTrade` with the offer id.
- **Reject** SHALL be shown, enabled when the id is in `legal.rejectTrade` and no action is in flight, and SHALL send `rejectTrade`.
- **Counter** SHALL be shown when `proposeTrade` is legal; it opens the offer composer prefilled with the offer's sides swapped (the viewer gives what was asked of them, capped by their hand, and asks for what was offered) and addressed only to the proposer.

For an offer the viewer made:
- the entry SHALL show each recipient and whether they are still deciding or declined;
- **Cancel** SHALL be shown, enabled when the id is in `legal.cancelTrade` and no action is in flight, and SHALL send `cancelTrade`.

While the viewer is not the active player and `proposeTrade` is legal, the tray (or, when it has no entries, a small floating button in its place) SHALL offer **Make an offer** to the active player, which opens the offer composer.

#### Scenario: Incoming offer
- **WHEN** seat 1, the active player, offers 1 ore for 1 wool to seats 0 and 2, and the viewer is seat 0 holding 1 wool
- **THEN** the tray shows seat 1's offer as "You give 1 Wool, you get 1 Ore" with Accept, Reject and Counter enabled

#### Scenario: Cannot afford
- **WHEN** an offer to the viewer asks for 2 wool and the viewer holds 1 wool
- **THEN** Accept is disabled and the entry says the viewer lacks the cards, while Reject stays enabled

#### Scenario: Accept
- **WHEN** the viewer presses Accept on offer 4
- **THEN** the client sends `acceptTrade` with offerId 4

#### Scenario: Declined offer leaves the viewer's tray
- **WHEN** the viewer rejects an offer addressed to them and to another player who has not answered
- **THEN** the offer is no longer listed for the viewer, and the proposer's tray shows the viewer as declined

#### Scenario: Own offer
- **WHEN** the active viewer has an open offer to seats 1 and 2 and seat 2 declined
- **THEN** the tray lists the offer with seat 1 deciding, seat 2 declined, and an enabled Cancel that sends `cancelTrade`

#### Scenario: Counter-offer
- **WHEN** a non-active viewer holding 3 wool presses Counter on the active player's offer of 1 ore for 2 wool
- **THEN** the composer opens with give wool 2, ask ore 1 and the active player as the only recipient, and the original offer is still listed

#### Scenario: Offers between others hidden
- **WHEN** seat 2 counter-offers to seat 1 and the viewer is seat 0
- **THEN** the viewer's tray does not list that offer

#### Scenario: Turn ends
- **WHEN** the active player ends their turn with offers open
- **THEN** the tray is empty for every viewer and any open composer closes

### Requirement: Incoming offer notification
When a new offer addressed to the viewer appears in the view, the HUD SHALL show a short toast naming the proposer, and the new tray entry SHALL be briefly highlighted. Offers already open when the viewer joins or resumes SHALL NOT raise a toast. Offers made by the viewer SHALL NOT raise a toast for the viewer.

#### Scenario: New offer toast
- **WHEN** seat 1 sends an offer that includes the viewer
- **THEN** the viewer sees one toast saying seat 1 made them an offer

#### Scenario: Resume
- **WHEN** the viewer reloads the page while an offer to them is open
- **THEN** the offer is listed in the tray and no toast is shown

### Requirement: Trade text is translated
Every new label, status line, summary, toast and accessible name in the composer, tray and Trade with players button SHALL exist in every supported language catalog, with plural forms where a count is shown.

#### Scenario: Spanish tray
- **WHEN** the language is Spanish and an offer is open to the viewer
- **THEN** the tray's buttons, sides and status text are in Spanish
