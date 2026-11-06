## ADDED Requirements

### Requirement: Active player's card is highlighted
The player card of the seat whose turn it is SHALL be visibly highlighted with a bright gold ring, a soft glow and a warm tinted background, strong enough to see at a glance on desktop, tablet, phone and short screens. The highlight SHALL move to the next seat when the turn changes and SHALL NOT show once the game has ended. Other cards SHALL keep their normal look and readability. The card SHALL keep `data-active` and `aria-current="true"` so the state does not rely on colour alone.

#### Scenario: Turn highlight shown
- **WHEN** it is a seat's turn
- **THEN** only that seat's card has the gold ring, glow and tinted background, and `data-active` and `aria-current="true"`

#### Scenario: Turn passes
- **WHEN** the turn passes to the next seat
- **THEN** the highlight leaves the previous card and appears on the next one

#### Scenario: Game ended
- **WHEN** the game phase is ended
- **THEN** no card is highlighted

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion
- **THEN** the highlight is shown without any pulse animation
