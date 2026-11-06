## ADDED Requirements

### Requirement: Seat lookup
The server SHALL accept `lookupSeats` from any connection, with up to 20 entries of room code and seat token, and SHALL answer with one `seatsInfo` message holding one entry per requested room, in request order. For a room that exists and whose token matches a seat, the entry SHALL hold: the room code, the status (`lobby`, `playing`, `paused` or `ended`), the viewer's seat, every seat's display name, the host seat, the game's turn number when the room is loaded in server memory, the pause time when paused, the expiry time computed from the room's remaining time to live, the room's creation time, the game's start time (null in the lobby), and the time of its last activity (last stored move, pause, resume, early end or start; null in the lobby). For a room that does not exist or whose token matches no seat, the entry SHALL be `{ room, status: "gone" }`, so a wrong token never reveals whether the room exists. The lookup SHALL read only the room's metadata (never replay a game), SHALL NOT bind the connection to any seat, SHALL NOT change presence, and SHALL NOT refresh any expiry. More than 20 entries SHALL be refused with `bad_frame`. A store failure SHALL be answered with `unavailable`.

#### Scenario: Two saved rooms, one gone
- **WHEN** a client looks up a paused room with a valid token and a room that expired
- **THEN** `seatsInfo` lists the paused room with names, pause time and expiry, and the other as `gone`

#### Scenario: Wrong token
- **WHEN** a client looks up an existing room with a token that matches no seat
- **THEN** the entry is `gone`, identical to a missing room

#### Scenario: Lookup has no side effects
- **WHEN** a client looks up a playing room where the seat is held by another connection
- **THEN** that connection keeps its seat and other players see no presence change

### Requirement: Saved games list
The start screen SHALL list the rooms this browser holds a seat token for, by sending `lookupSeats` with every stored room and token whenever the start screen is shown while connected. Each listed room SHALL show its code, its status (waiting in lobby / playing / paused by the host), the player names with the viewer's own marked, the turn number when reported, when it was started (or created, for a lobby) and its last move, and for paused rooms the date it expires, so that games with the same players can be told apart. Rooms SHALL be ordered paused and playing first, then lobby, most recently used first. Each entry SHALL have "Continue", which resumes that seat with the stored token, and "Remove", which forgets the token locally. Entries reported `gone` or `ended` SHALL be removed from storage and not shown. While the lookup is pending the list SHALL show a loading state; with no stored rooms the list SHALL not be shown. All text SHALL be available in English and Spanish.

#### Scenario: Continue a paused game
- **WHEN** a player opens the start screen days later and their paused room is listed
- **THEN** "Continue" resumes their seat and shows the paused game with the paused notice

#### Scenario: Expired room disappears
- **WHEN** the lookup reports a stored room as `gone`
- **THEN** it is not shown and its token is removed from storage

#### Scenario: Two games with the same players
- **WHEN** the list shows two playing rooms with the same three names
- **THEN** each shows its own start date and last move, so the player can tell which is which

#### Scenario: Remove an entry
- **WHEN** the player presses "Remove" on a listed room
- **THEN** the entry disappears and its token is forgotten, and the room is unchanged on the server
