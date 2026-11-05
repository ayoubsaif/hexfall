## ADDED Requirements

### Requirement: Notification opt-in
The HUD SHALL offer a notifications control next to the sound toggle. It SHALL be hidden when the browser supports neither the Notification API nor service workers. The client SHALL request notification permission only when the viewer activates this control, never on page load. The control SHALL show one of three states: off, on, or blocked (permission denied, with a hint that it can be changed in browser settings). The viewer's choice (on/off) SHALL be stored in `localStorage`.

#### Scenario: Enable notifications
- **WHEN** the viewer activates the control and grants permission
- **THEN** the control shows on and the client starts push subscription (see "Push subscription")

#### Scenario: Permission denied
- **WHEN** the viewer activates the control and denies permission
- **THEN** the control shows blocked with the settings hint, and no further permission prompt is made by the page

#### Scenario: No prompt on load
- **WHEN** a viewer who never enabled notifications opens the game
- **THEN** no permission prompt appears

### Requirement: Service worker
The client SHALL register a service worker at `/sw.js` with scope `/` when the browser supports service workers. The service worker SHALL only handle `push` and `notificationclick` events and SHALL NOT cache or intercept network requests. The client SHALL ship a web app manifest linked from `index.html` so the game can be installed (needed for push on iOS).

#### Scenario: No fetch handling
- **WHEN** the service worker is active and the page loads assets
- **THEN** every request goes to the network unchanged

### Requirement: Push subscription
When notifications are on, permission is granted, the server's `welcome` carried a non-null `pushKey`, and the viewer holds a seat in a room, the client SHALL subscribe through the service worker's `PushManager` with `userVisibleOnly: true` and that key, and SHALL send `pushSubscribe` with the subscription and the current UI language. It SHALL send it again after every join or resume and whenever the language changes. When the viewer turns notifications off, the client SHALL send `pushUnsubscribe` and unsubscribe the browser subscription. When the subscribed key differs from the server's `pushKey`, the client SHALL unsubscribe and subscribe again.

#### Scenario: Resume re-sends the subscription
- **WHEN** notifications are on and the viewer resumes their seat after a reload
- **THEN** `pushSubscribe` is sent for that seat

#### Scenario: Server without push
- **WHEN** `welcome.pushKey` is null
- **THEN** the client does not subscribe and uses the local notification fallback

#### Scenario: Turn off
- **WHEN** the viewer turns notifications off
- **THEN** `pushUnsubscribe` is sent and no push reaches this browser for that seat

### Requirement: Visibility reporting
While the viewer holds a seat, the client SHALL send `visibility` with `visible: true|false` after joining or resuming and on every `visibilitychange` of the document.

#### Scenario: Switch tabs
- **WHEN** the viewer switches to another browser tab
- **THEN** the client sends `visibility` with `visible: false`

### Requirement: Push notification display
On a `push` event the service worker SHALL show a notification built from the payload: the wait kind (`turn`, `rollForOrder`, `setup`, `discard`), the room code and the language. Text SHALL be localized in English and Spanish, falling back to English, for example "Your turn — room ABCD" / "Tu turno — sala ABCD", with body text for the kind ("Roll the dice", "Discard half your cards", …). Notifications SHALL use a per-room `tag` and `renotify: true`, so a newer alert replaces an older one for the same room. The service worker SHALL show a notification for every push it receives (pushes are `userVisibleOnly`); avoiding alerts to a visible page is the server's job (see game-server "Turn push delivery").

#### Scenario: Turn push in Spanish
- **WHEN** a push with kind `turn`, room `ABCD` and language `es` arrives
- **THEN** a notification titled "Tu turno — sala ABCD" is shown

#### Scenario: Older alert replaced
- **WHEN** two pushes for room `ABCD` arrive before the first was read
- **THEN** only one notification for that room is shown

### Requirement: Notification click
Clicking a notification SHALL close it and SHALL focus an open window of the app whose address carries that room; if none exists it SHALL focus any open window of the app and navigate it to `/?room=CODE`; if no window is open it SHALL open `/?room=CODE`. The existing resume flow then restores the seat.

#### Scenario: Tab closed
- **WHEN** the player has no game tab open and clicks the turn notification for room `ABCD`
- **THEN** a new window opens at `/?room=ABCD` and resumes their seat

#### Scenario: Tab in background
- **WHEN** the game tab for room `ABCD` is open but hidden and the player clicks the notification
- **THEN** that tab is focused and no new window opens

### Requirement: Local notification fallback
When notifications are on and permission is granted but no push subscription is active (push unsupported or `pushKey` null), the client SHALL show a `Notification` from the page when a wait on the viewer begins (same trigger as the turn chime) while the document is hidden. It SHALL use the same text, tag and click behavior (focus this window). When a push subscription is active, the page SHALL NOT show local notifications, so one event never yields two notifications.

#### Scenario: Push unavailable, tab hidden
- **WHEN** the browser lacks `PushManager`, notifications are on, the tab is hidden and the viewer's turn starts
- **THEN** the page shows one "Your turn" notification

#### Scenario: Push active, tab hidden
- **WHEN** a push subscription is active and the viewer's turn starts while the tab is hidden
- **THEN** the page shows no local notification (the server push covers it)
