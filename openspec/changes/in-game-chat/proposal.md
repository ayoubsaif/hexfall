## Why

Players on the same table have no way to talk to each other. A small in-game chat lets them coordinate trades and banter without leaving the game.

## What Changes

- Seated players can send short text messages (max 300 characters) to everyone in the room.
- The chat is a third tab (Chat) in the existing Log drawer, built on the shadcn `message` and `bubble` components; an unread dot shows on the Log button.
- Messages are held in server memory only (last 50 per room), replayed to a seat when it joins or resumes, and never written to Redis. They are lost when the room ends or the server restarts.
- Protocol version 8: client message `chat`; server messages `chatLine` and `chatHistory`.

## Impact

- `packages/protocol`, `apps/server` (`rooms/room.ts`, `rooms/service.ts`, `session.ts`), `apps/client` (`store/chat.ts`, `net/session.ts`, `hud/ChatPanel.tsx`, `hud/Hud.tsx`, `components/ui/message.tsx`, `bubble.tsx`, i18n en/es).
- No Upstash/Redis cost: chat never touches the store.
