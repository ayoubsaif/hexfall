## Why

Players are only a name and a color swatch. In a 3–4 player game people lose track of who is who in the scoreboard, trade dialogs and notifications. A small set of friendly, recognizable portraits fixes that and gives the game a face. The toast stack also sits mid-screen over the board, so it hides play; it belongs next to the action buttons.

## What Changes

- New avatar catalog: 12 hand-illustrated portraits (6 men, 6 women) of common folk of the 10th century (farmer, shepherd, woodcutter, blacksmith, fisher, herbalist, weaver, baker…). No kings, nobles or clergy of rank. Flat animation/cartoon style with low detail, matching the supplied reference (bearded villager in a hooded scarf and leather vest).
- Assets: 500×500 px WebP, square, subject centered inside the inscribed circle, no baked-in frame. The ring is drawn by the client in the seat color so it reads at every size.
- Players pick an avatar before the game starts: in the create/join form and in the lobby, where it can be changed until the host starts. Avatars are unique per room; taken ones are shown disabled.
- Avatar is part of the seat (`SeatInfo.avatar`), visible to everyone, saved with the game and restored on resume. Bots get a free avatar automatically. Seats from older saved games get a default by seat number.
- New `Avatar` component (circle, seat-color ring, initial-letter fallback) used in: player scoreboard (player panels), trade dialog and offers tray (player names), and notifications (toasts).
- Toasts move from top-center to the bottom-right, stacked just above the action buttons (where Trade lives); on phones they stay clear of the hand and buttons. Toasts about a player show that player's avatar.
- **BREAKING (wire):** `SeatInfo` gains required `avatar`; `createRoom`/`joinRoom` gain optional `avatar`; new `setAvatar` message; protocol version bump.

## Capabilities

### New Capabilities
- `player-avatars`: the avatar catalog and asset format, picking and changing an avatar in the lobby, per-room uniqueness, persistence, and where avatars are shown.
- `hud-notifications`: placement and behavior of the toast stack (bottom-right above the action buttons, non-blocking, avatar on player toasts).

### Modified Capabilities
- `game-server`: seats carry an avatar; `createRoom`/`joinRoom`/`setAvatar`; uniqueness and `bad_avatar`/`avatar_taken` errors; bots get avatars; avatar stored in saved seats.
- `saved-games`: stored seats keep the avatar; older saves without one get a default on load.

## Impact

- New: `apps/client/public/avatars/*.webp` (12 files), `apps/client/src/hud/Avatar.tsx`, `AvatarPicker.tsx`.
- `packages/protocol`: `AVATAR_IDS`, `AvatarId`, `SeatInfo.avatar`, message and error additions, version bump.
- `apps/server/src/rooms/{room,service}.ts`, `store/types.ts`.
- `apps/client`: `hud/{StartScreen,Lobby,PlayerPanels,TradePanel,OffersTray,Feed,Hud,names}`, `game/describe.ts` (toast carries a seat), `net/{actions,session}`, `store/{room,prefs}.ts`, i18n `en`/`es`, service worker precache if it lists assets.
- Touches files that `add-bots` also edits (`Lobby`, `room.ts`, `messages.ts`); implement after it lands.
- Out of scope: custom image upload, avatar for spectators, animated avatars, changing avatar mid-game.
