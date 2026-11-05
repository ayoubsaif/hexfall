## ADDED Requirements

### Requirement: Push configuration
The server SHALL read optional `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:` or `https:` URL). Push SHALL be enabled only when all three are set and valid; when only some are set, the server SHALL refuse to start with a config error naming the missing ones. The `welcome` message SHALL carry `pushKey`: the VAPID public key when push is enabled, otherwise null. The protocol version SHALL be 4.

#### Scenario: No VAPID keys
- **WHEN** the server starts without any VAPID variables
- **THEN** it starts normally, `welcome.pushKey` is null and no push is ever sent

#### Scenario: Partial keys
- **WHEN** only `VAPID_PUBLIC_KEY` is set
- **THEN** the server exits with a config error naming `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`

### Requirement: Push subscriptions
The server SHALL accept `pushSubscribe` from a connection that holds a seat, carrying a Web Push subscription (endpoint and keys, endpoint an `https:` URL of at most 1024 characters) and a language code. The server SHALL store it for that room and seat in Redis, with the same expiry as the room, keeping at most 3 subscriptions per seat (the newest replace the oldest; an equal endpoint replaces its earlier entry). `pushUnsubscribe` with an endpoint SHALL remove that subscription. Both SHALL be refused with `no_seat` from a connection without a seat. Subscriptions SHALL be deleted when the room is deleted or the seat is freed in the lobby. A store failure SHALL be answered with `unavailable` and SHALL NOT affect the game.

#### Scenario: Subscribe after join
- **WHEN** seat 2 sends `pushSubscribe`
- **THEN** the subscription is stored under that room and seat 2

#### Scenario: Not seated
- **WHEN** a connection in no room sends `pushSubscribe`
- **THEN** it receives `no_seat` and nothing is stored

### Requirement: Connection visibility
The server SHALL track, per seated connection, whether its page is visible, from `visibility` messages. A connection SHALL count as visible from the moment it joins or resumes until it reports `visible: false`. Visibility SHALL NOT be persisted and SHALL NOT be shown to other players.

#### Scenario: Hidden tab
- **WHEN** seat 1 is connected and reports `visible: false`
- **THEN** the server treats seat 1 as having no visible connection

### Requirement: Turn push delivery
After every accepted action and every applied timeout (and when a game starts), once the result is persisted and broadcast, the server SHALL compute the seats the game waits for before and after. For each seat that is waited for after but was not before, and that has no connected visible connection, the server SHALL send one push to each of that seat's stored subscriptions, with a payload holding the wait kind (`rollForOrder`, `setup`, `turn`, or `discard`), the room code and the stored language. Sending SHALL happen in the background: it SHALL NOT delay or block game actions, and its failure SHALL NOT change the game. A subscription the push service answers with 404 or 410 SHALL be deleted. No push SHALL be sent once the game has ended. Pushes SHALL use a time-to-live no longer than the current deadline, or 1 hour when the timer is off.

#### Scenario: Turn starts while away
- **WHEN** seat 0 ends their turn and seat 1 has no connection
- **THEN** seat 1's stored subscriptions each receive one push of kind `turn`

#### Scenario: Visible player gets no push
- **WHEN** seat 1's turn starts and seat 1 is connected with a visible page
- **THEN** no push is sent

#### Scenario: Discard after a 7
- **WHEN** seat 0 rolls a 7, seat 2 must discard and its tab is hidden
- **THEN** seat 2 receives one push of kind `discard`, and seat 0 receives none (seat 0 was already waited for)

#### Scenario: Expired subscription
- **WHEN** the push service answers 410 for a subscription
- **THEN** the server deletes it and does not try it again

#### Scenario: Push service down
- **WHEN** the push service times out
- **THEN** the game update has already been delivered and the next action is processed normally
