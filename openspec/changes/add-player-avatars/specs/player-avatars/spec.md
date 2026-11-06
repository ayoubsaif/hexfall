## ADDED Requirements

### Requirement: Avatar catalog and asset format
The client SHALL ship a fixed catalog of 12 avatars, each with a stable kebab-case id listed in `AVATAR_IDS` of `@hexfall/protocol`. Each asset SHALL be a square WebP of at most 500×500 px at `/avatars/<id>.webp`, with the subject inside the inscribed circle and no baked-in frame or transparent-corner dependency. The set SHALL contain 6 men and 6 women portraits of common people of the 10th century, in a flat, low-detail animation style; it SHALL NOT include royalty, nobility or high clergy.

#### Scenario: Every id has an asset
- **WHEN** the catalog is checked
- **THEN** each id in `AVATAR_IDS` has a file under `public/avatars/` no larger than 500×500 px

#### Scenario: Reference portrait included
- **WHEN** the catalog is listed
- **THEN** it includes the bearded villager portrait with the hooded scarf and leather vest

### Requirement: Choosing an avatar before the game
A player SHALL be able to pick an avatar when creating or joining a room and to change it in the lobby until the host starts the game. Avatars SHALL be unique within a room. The picker SHALL show every catalog avatar, mark the ones taken by other seats as disabled with the owner's name, and be operable by keyboard. If no avatar is chosen, the server SHALL assign the first free one in catalog order. The client SHALL remember the last choice and offer it again.

#### Scenario: Pick on join
- **WHEN** a player joins choosing a free avatar
- **THEN** their seat shows that avatar to everyone in the room

#### Scenario: Taken avatar
- **WHEN** a player tries to choose an avatar another seat holds
- **THEN** the request fails with `avatar_taken` and the seat keeps its previous avatar

#### Scenario: Change in the lobby
- **WHEN** a seated player picks a different free avatar before the game starts
- **THEN** all clients show the new avatar and the old one becomes free

#### Scenario: Square selector states
- **WHEN** the picker is shown
- **THEN** each option is a square tile (equal width and height, slightly rounded corners) around its round avatar, never a stretched pill
- **AND** hovering an enabled tile darkens it with a translucent dark overlay
- **AND** the selected tile keeps a visible dark overlay plus a distinct border and a check badge, so it is distinguishable from hover without relying on color alone
- **AND** keyboard focus shows a separate focus ring, and taken tiles show no hover effect

#### Scenario: Locked after start
- **WHEN** the game has started and a player sends `setAvatar`
- **THEN** it fails with `game_started` and nothing changes

### Requirement: Avatar display
The client SHALL render a seat's avatar as a circle with a ring in the seat color, in the player scoreboard, in the trade dialog and offers tray wherever a player is named, in the lobby seat list, and on toasts about a player. If the image is missing or fails to load, the client SHALL show the first letter of the player's name on the seat color. Avatar images SHALL have empty alt text because the name is shown beside them.

#### Scenario: Scoreboard
- **WHEN** a game is in progress
- **THEN** each player panel shows that seat's avatar with its seat-color ring next to the name

#### Scenario: Trade targets
- **WHEN** the trade dialog lists players to trade with
- **THEN** each entry shows the player's avatar next to the name

#### Scenario: Image fails
- **WHEN** an avatar image fails to load
- **THEN** the circle shows the name's initial on the seat color

### Requirement: Bot avatars
A bot seat SHALL receive the first free avatar when it is added, and SHALL keep it for the game.

#### Scenario: Bot added
- **WHEN** the host adds a bot to a lobby where avatars 1 and 2 are taken
- **THEN** the bot shows the third avatar in catalog order

### Requirement: Avatar text in both languages
Picker labels, avatar names used as tooltips or accessible names, and new error messages SHALL come from the active language's translations in English and Spanish.

#### Scenario: Spanish picker
- **WHEN** the language is Spanish
- **THEN** the picker title and the `avatar_taken` message are shown in Spanish
