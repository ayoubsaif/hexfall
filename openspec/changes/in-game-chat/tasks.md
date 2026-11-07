## 1. Protocol and server

- [x] 1.1 Protocol v8: `chat`, `chatLine`, `chatHistory`, `CHAT_MAX_LENGTH`, `CHAT_HISTORY`
- [x] 1.2 `Room.chat` (clean, cap, broadcast) and history replay on create, join, resume; `RoomService.chat`; session routing
- [x] 1.3 Server tests: delivery, cleaning, cap, no-seat, history on resume

## 2. Client

- [x] 2.1 `store/chat.ts` (entries, unread, cap, de-dup); session handling, `sendChat`, clear on leave
- [x] 2.2 `message.tsx` and `bubble.tsx` components; `ChatPanel` with input and send
- [x] 2.3 Chat tab in the log drawer, unread dot on the Log button, i18n (en, es)
- [x] 2.4 Client tests: store, panel, session handling

## 3. Check

- [ ] 3.1 Play-test with two browsers: send, receive, rejoin history, unread dot, 360 px layout

## 4. Drawer layout (owner request)

- [x] 4.1 Chat is the first tab and the default; the Log tab holds the dice statistics (compact chart) above the event log; the separate Dice tab is gone
- [x] 4.2 Unread dot is light green; chat bubbles are square cards
