## ADDED Requirements

### Requirement: Card flights for transfers
For each live game update the client SHALL animate every resource or development card transfer in the update's events as small cards that fade in at the source, move to the destination and fade out there. Endpoints SHALL be the bank (board center), another seat's player panel, or the viewer's own hand slot for that card.

#### Scenario: Production
- **WHEN** a live update contains `produced` for a seat with 2 grain
- **THEN** two grain cards fly from the bank to that seat (the viewer's grain slot when it is the viewer)

#### Scenario: Spending
- **WHEN** a seat builds a paid road or buys a development card
- **THEN** the cost's cards fly from that seat to the bank and fade away

#### Scenario: Steal and trade
- **WHEN** a live update contains `stole`, `monopoly`, `tradeAccepted` or `maritimeTrade`
- **THEN** cards fly from the giving side to the receiving side for each direction of the transfer

#### Scenario: Development card played
- **WHEN** a seat plays a development card
- **THEN** that card flies from the seat to the bank and fades away

### Requirement: Hidden cards stay hidden
A flight SHALL show a card back when the view does not reveal the card (a steal between other seats, another seat's bought development card).

#### Scenario: Redacted steal
- **WHEN** the viewer is neither thief nor victim of a steal
- **THEN** the stolen card flies as a card back

### Requirement: Flights are suppressed when not live
Flights SHALL NOT play for snapshots (join, resume, reconnect), when the motion preference resolves to reduced, or while the document is hidden. Flights SHALL never intercept pointer input.

#### Scenario: Reconnect
- **WHEN** the client receives a snapshot
- **THEN** no card flight plays
