## ADDED Requirements

### Requirement: Seat avatars
Each seat SHALL have an avatar id from the shared catalog, reported to all clients as `SeatInfo.avatar`. `createRoom` and `joinRoom` MAY carry an `avatar`; if absent, the server SHALL assign the first free catalog id. Avatars SHALL be unique per room. In the lobby a seated player MAY send `setAvatar`; it SHALL fail with `bad_avatar` for an id outside the catalog, `avatar_taken` when another seat holds it, and `game_started` outside the lobby. Changes SHALL be sent to everyone in the room. A requested avatar that is taken at create/join time SHALL NOT fail the join; the server assigns the first free one instead.

#### Scenario: Default assignment
- **WHEN** a player joins without an avatar and the first catalog avatar is held
- **THEN** the seat gets the next free one

#### Scenario: Unknown id
- **WHEN** a client sends `setAvatar` with an id not in the catalog
- **THEN** it fails with `bad_avatar`

#### Scenario: Join with a taken avatar
- **WHEN** a player joins requesting an avatar another seat holds
- **THEN** the join succeeds with the first free avatar

#### Scenario: Broadcast
- **WHEN** a seat changes avatar in the lobby
- **THEN** every client in the room receives the updated seat list

### Requirement: Avatar on the wire
The protocol version SHALL be bumped for the avatar fields, and `SeatInfo.avatar` SHALL be required.

#### Scenario: Old client
- **WHEN** a client with the previous protocol version connects
- **THEN** it is rejected with the existing version mismatch error
