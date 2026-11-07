# hand-cards Specification

## Purpose
Define how cards in the viewer's edge hand look and how stacks of the same card are drawn at rest and when fanned out on hover or keyboard focus.

## Requirements

### Requirement: Classic hand card face
Each card in the edge hand SHALL use the classic HUD style: a dark leather border and rounded corners. A resource card SHALL have a parchment face with an inner rim in the resource's color, the resource icon large in the upper half, and a small copy of the icon in the top-left corner. A development card SHALL keep its painted art inside the same leather border. The count badge SHALL stay at the top right. Cards in dialogs SHALL keep their existing look.

#### Scenario: Resource card in the hand
- **WHEN** the viewer holds a brick card
- **THEN** the hand's brick card has the leather border, a parchment face, the brick-colored rim, a large brick icon and a small brick icon in the top-left corner

#### Scenario: Dialog card unchanged
- **WHEN** the discard dialog shows the viewer's cards
- **THEN** those cards use the default layout without the corner icon

### Requirement: Stack at rest
When the viewer holds 2 or more of one card, the hand SHALL draw the cards behind the front card as card tops peeking straight up above it: one for 2 cards and two for 3 or more. Each SHALL be drawn as a full card (border, face and corner icon). A single card SHALL have nothing behind it.

#### Scenario: Two cards
- **WHEN** the viewer holds 2 ore
- **THEN** one ore card top shows above the front ore card

#### Scenario: Five cards
- **WHEN** the viewer holds 5 brick
- **THEN** two brick card tops show above the front card and the badge reads 5

### Requirement: Stack fans out on hover
When a stack's hand slot is hovered or holds keyboard focus, every card behind the front one (up to 8) SHALL rise so that each shows a further 10 % of the card height above the one in front of it, drawn in full with its border, face, icon and corner icon. The fan SHALL return when the pointer or focus leaves, and SHALL appear without motion when the user prefers reduced motion. The cards behind SHALL be hidden from assistive technology; the front card's name and count still describe the stack.

#### Scenario: Hover a stack of four
- **WHEN** the pointer hovers a slot holding 4 wool
- **THEN** three wool cards show above the front card at 10 %, 20 % and 30 % of the card height, each with its icon and corner icon

#### Scenario: Screen reader
- **WHEN** a screen reader reads the wool slot
- **THEN** it reads "Wool, 4" once and nothing for the cards behind
