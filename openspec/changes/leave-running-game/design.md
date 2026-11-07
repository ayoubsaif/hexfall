## Context

See proposal.md for motivation. Relevant current state:

- `Room.leave()` (`apps/server/src/rooms/room.ts`) only works in the lobby: it removes the seat from `meta.seats`, splices `conns`, shifts the host index, deletes the room when no human is left, and calls `deps.seatLeft` (push unsubscribe). After the start it fails with `game_started`.
- `Room.join()` fails with `game_started` outside the lobby.
- A seat is a bot when `meta.seats[i].bot === true`. Bots have an unusable token hash. `pendingBots()` / the bot scheduler read `meta.seats` each time they run, and `roomState` reports bots as connected.
- The engine knows nothing about humans vs bots; seats are just indices. Stored actions replay without looking at the bot flag.
- The HUD has `HostGameMenu` (`apps/client/src/hud/GamePause.tsx`), rendered only for the host, with the painted `pause` icon on its trigger.
- Chat (`ChatEntry` with `seat`, `name`) is held in memory per room and sent to joiners as history.

## Goals / Non-Goals

**Goals:**
- Leaving and taking over are pure room-meta changes; the game state and the stored action log are untouched.
- The game never waits on a seat whose human left.
- No change to rules, the engine, or the stored action format.

**Non-Goals:**
- Taking over bots that were bots from the start (lobby-added or auto-filled).
- Letting the leaver reclaim their seat with their old token (they can join again as a newcomer).
- Kicking other players, or voting to replace an inactive player.
- Choosing which open seat to take when several are open (the lowest one is given).
- Changing lobby leave behaviour.

## Decisions

**1. Turn the seat into a bot in place, marked `open`.**
On leave in a started room, replace `meta.seats[seat]` with `{ ...newBotSeat(), open: true }` (fresh bot name and an unusable token hash), keeping the array length and order. Alternative: keep a human seat with a "vacant" flag and let the turn timer time out its waits — rejected, because with the timer off the game would stall forever, and the user chose "bot plays it". Reusing the bot flag means the existing scheduler, presence (`connected: true`) and saved-games lookup (`bots[]`, no usable token) work without new branches. `open` is optional in the stored meta, so old rooms load as "not open".

**2. Takeover reuses `joinRoom`.**
`join()` in a `playing`/`paused` room finds the lowest seat with `open: true`, validates the name against the other seats, picks the avatar, and writes `{ name, tokenHash, avatar }` (no `bot`, no `open`). Then it binds the connection, sends `roomJoined` with the new token, room state, chat history and `sendSnapshot(seat)` like `resume()` does. Alternative: a new `claimSeat` message — rejected; the invite link and join form already send `joinRoom`, so newcomers need no new client path, and the protocol stays smaller.

**3. Bot scheduling follows meta changes.**
After a leave, call the existing "schedule next bot move" so the bot acts at once if the game waits on that seat. After a takeover, cancel the pending bot timer and re-schedule; since the bot move handler re-checks `isBot(seat)` and the state version when it fires (inside `run()`), a stale move for a taken-over seat is dropped. Add that re-check if it is missing.

**4. Bot handles leftovers through legal actions.**
The bot already covers discard, robber, Road Building and its own turn. Add one case: if `legalActions(state, seat).cancelTrade` is non-empty, cancel first. `pendingBots()` must include a seat holding a cancellable offer. Rejections of offers to the seat already exist.

**5. Host transfer and last human.**
Host leaving a started room: `host = lowest seat with no bot flag` after the change. If no human remains, delete the room (same path as the lobby case), which also stops timers. `deps.seatLeft(tokenHash)` is called for the leaver in both cases.

**6. Leave / takeover notices as chat system lines.**
Add an optional `system: "left" | "tookOver"` field to `ChatEntry`; the entry's own `seat` and `name` say who left or took over, and `text` is empty. The server appends it to the room chat on leave and takeover; the client renders it localized ("Ben left; a bot is playing Blue"). Alternative: engine log events — rejected, because the engine log is rules-only and replayed, and seat holders are not engine state. Chat is in-memory only, so these lines are lost on restart; acceptable for a notice.

**7. Protocol: `SeatInfo.open`.**
`roomState` seats gain `open: boolean`. The client shows an "Open seat" badge on that player panel.

**8. HUD: one game menu for everyone, with a leave icon.**
Rename `HostGameMenu` → `GameMenu`, render it for every seated human during `playing`/`paused`. Items: invite link + copy, "Leave game" (confirm dialog → `leaveRoom()`), and host-only "Close game for now" / "End game now". The trigger button uses a new painted gold `leave` icon (`public/ui/icons/leave.webp`, 128 px, transparent, door with outward arrow, matching the embossed-gold set) added to `GameIconName`; `pause` stays on the "Close game for now" item. The leave request id is `"leave"` (already used by the lobby), so errors surface the same way. On `roomLeft` the session already forgets the token; it must also clear the game view and show the start screen.

## Risks / Trade-offs

- [The painted icon set is hand-made, with no generator in `tools/`] → Produce `leave.webp` to match (generate it at 128 px with the same gold emboss and drop shadow, or the user supplies one); until it lands, the task is not done — no lucide fallback in the shipped HUD.
- [A bot takes a seat mid-action, e.g. half-way through Road Building] → The bot acts only through legal actions from the current state, which already covers every waiting phase; add tests for each.
- [Race: takeover and bot move arrive together] → Both go through the room's `run()` queue; the bot move re-checks `isBot` and version before committing.
- [Earlier log lines show the seat's new name] → Log entries refer to seats, names come from room state. Acceptable; the system chat line records the change.
- [Someone with the code takes an open seat the table didn't want filled] → Same trust model as the lobby invite link; out of scope.
- [Push notifications for the leaver] → `seatLeft` unsubscribes them, as in the lobby.

## Migration Plan

No data migration: `open` is optional and defaults to false. Deploy server and client together; an old client joining a started room would get `roomJoined` + `gameSnapshot`, which it already handles via the resume path. Rollback: revert; open seats in stored rooms remain normal bot seats.
