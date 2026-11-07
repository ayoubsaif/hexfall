## 1. Protocol

- [x] 1.1 Add optional `open` to `SeatInfo` in `packages/protocol/src/messages.ts` and an optional `system: "left" | "tookOver"` to `ChatEntry`; verify with new cases in `packages/protocol/test/messages.test.ts`
- [x] 1.2 Add optional `open` to the stored room-meta seat type and make old metas load as not open; verify with a store/room test loading a meta without the field

## 2. Server: leave a running game

- [x] 2.1 Extend `Room.leave()` for `playing`/`paused`: replace the seat with a fresh `open` bot seat in place (same index), persist before broadcasting, unbind and send `roomLeft`, call `seatLeft`; `ended` fails `game_over`; verify with `apps/server/test/rooms.test.ts` cases "non-host leaves mid-game" and "leave after the game ended"
- [x] 2.2 Host transfer to the lowest remaining human, and delete the room when the last human leaves a started game; verify with tests "host leaves" and "last human leaves" (room gone, timers stopped)
- [x] 2.3 Old token stops working: resume fails `bad_token`, `lookupSeats` returns `gone`; verify with a service test
- [x] 2.4 Store failure refuses the leave with `unavailable` and keeps the seat; verify with the failing-store test helper

## 3. Server: bot plays the open seat

- [x] 3.1 After a leave, schedule the bot at once; verify a test where the leaver owed a discard and the bot discards the right count
- [x] 3.2 Bot cancels its own open trade offer (`cancelTrade`) and `pendingBots()` includes seats with a cancellable offer; verify the "leaver was the active player with an open offer" test ends the turn and advances
- [x] 3.3 Cover leftover phases (robber move/steal, Road Building, mid-turn after roll) with one test each; no action rejected
- [x] 3.4 No bot move while paused after a leave; verify the bot moves only after resume

## 4. Server: take over an open seat

- [x] 4.1 Extend `Room.join()` for `playing`/`paused`: give the lowest open seat, validate name, choose avatar, new token, clear `bot`/`open`, persist, send `roomJoined` + room state + chat history + snapshot; otherwise `game_started`; verify tests "newcomer takes the seat", "no open seat", "auto-filled bots are not open", "leaver comes back"
- [x] 4.2 Cancel/re-schedule the bot timer on takeover and make the bot move handler re-check `isBot(seat)` and the version; verify "takeover on the seat's turn" test where the bot makes no further move
- [x] 4.3 Restart recovery: open seat and taken-over seat survive a rebuild from storage; verify with the existing restart test harness
- [x] 4.4 Append `left` / `tookOver` system chat entries on leave and takeover; verify they reach every connected seat and carry no hidden info

## 5. Client: session and state

- [x] 5.1 Store `open` per seat in `store/room.ts`; on `roomLeft` during a game forget the token, clear the game view and show the start screen; verify with `apps/client/test/net/session.test.ts`
- [x] 5.2 Joining a started room via code or invite link lands in the game view (roomJoined + gameSnapshot); verify with `apps/client/test/integration/session-game.test.ts`

## 6. Client: HUD

- [x] 6.1 Add a painted gold `leave` icon (`apps/client/public/ui/icons/leave.webp`, 128 px, transparent, door with outward arrow, matching the existing set) and `"leave"` to `GameIconName`; source kept at `apps/client/brand/icon-leave.svg`; verify `tools/check-assets.mjs` passes and the icon renders next to the others
- [x] 6.2 Rename `HostGameMenu` → `GameMenu`, render it for every seated human in `playing`/`paused`, trigger icon = `leave` (pause icon only on "Close game for now"); host keeps pause/end items; verify HUD tests for host and non-host menu contents and the trigger icon
- [x] 6.3 Add "Leave game" with a confirm dialog (explains bot takeover, no return with this saved game, room code can take it), sending `leaveRoom()` once, showing errors in the menu; add the invite link + copy to the menu; verify confirm/cancel tests
- [x] 6.4 "Open seat" badge on open player panels and localized system chat lines for `left` / `tookOver`; verify with HUD tests
- [x] 6.5 Add all new strings to `i18n/locales/en` and `es`; verify the i18n key-parity test passes

## 7. Verify

- [x] 7.1 Run the full test suite, typecheck and lint (`pnpm test`, `pnpm check`) and confirm all pass
- [ ] 7.2 Manual check in two browsers: non-host leaves mid-game, bot plays on, a third browser takes over with the invite link; host leaves and host passes on
