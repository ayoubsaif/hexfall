## Why

The HUD is a stack of boxed cards (turn bar, build bar, hand, development cards) along the bottom. It covers a lot of the board and feels like a form rather than a table. Players also miss the start of their turn, and one idle or absent player can stall the whole room indefinitely, because the server never acts for anyone.

## What Changes

- **Floating icon buttons, no panels.** End turn and the build/buy/trade controls become round icon buttons floating over the board at the bottom-right, with no surrounding card. Labels and costs move to tooltips and accessible names. Each build button shows how many of that piece you have left as a small badge.
- **BREAKING (UI):** the turn bar and build bar cards are removed. The turn status text becomes a small floating pill.
- **Build buttons hidden when it is not your turn.** They are removed from the screen rather than shown disabled. They are still shown, disabled, on your own turn before the roll.
- **Hand at the screen edge.** The resource cards sit at the bottom center, about half hidden below the bottom edge. A card rises fully on hover or keyboard focus. There is no panel around them, only a soft shadow behind the cards.
- **Development cards only when held.** The development-card panel and its "No development cards" text are removed. Held development cards appear next to the resource cards with the same half-off-edge look.
- **Your-turn focus.** When your turn starts and you must roll (or roll for order), the screen dims behind a translucent overlay, the dice move to the center, enlarged, and a "Your turn" message with the roll countdown appears. Tap the dice to roll. When the throw lands, the overlay fades and the dice return to their corner. The overlay can be dismissed, so a Knight can still be played before the roll. Screen readers get an assertive announcement, and the tab title is marked when the tab is hidden.
- **Turn timer, chosen by the host.** In the lobby the host picks **Off**, **Standard** (30 s to roll, 90 s idle) or **Relaxed** (60 s to roll, 120 s idle). When a wait runs out, the server acts for the player:
  - before the roll: rolls the dice;
  - after the roll: ends the turn once 90 s (or 120 s) pass with no action from the active player (the timer restarts on each of their actions);
  - setup: places a random legal settlement and road;
  - roll for order: rolls for everyone still to roll;
  - discard after a 7: discards random cards for everyone who still owes;
  - moving the robber: picks a random legal hex and victim;
  - Road Building: places the remaining free roads at random legal spots.
- Every player sees the countdown for whoever the game is waiting on. The log records "time ran out" before the automatic moves.
- **BREAKING (server rule):** the server now acts on a player's behalf when the room's timer is on. With the timer Off, behavior is unchanged.
- **Protocol v3:** `startGame` gains `turnTimer`; game updates and snapshots carry the current countdown.

## Capabilities

### New Capabilities

None. The timer belongs to existing capabilities.

### Modified Capabilities

- `rules-engine`: a new system-only `timeout` action resolves the current wait deterministically with the game RNG. Clients can never send it, and legal-move lists never include it.
- `game-server`:
  - "Starting a game" adds the timer preset;
  - "Presence" allows actions on a player's behalf when the timer is on;
  - a new "Turn timer" requirement covers deadlines, restarts, persistence and the countdown sent to clients.
- `game-hud`:
  - "Turn status and controls": floating icon buttons; build controls hidden off-turn; status pill.
  - "Own hand": development cards shown only when held.
  - "Dice display": the dice move to the center for the your-turn focus.
  - New requirements: "Your-turn focus" and "Turn countdown".
  - The lobby timer picker is covered by the "Turn countdown" requirement.
- `hud-presentation`:
  - "Responsive HUD layout": edge hand and floating buttons replace the bottom stack.
  - "Development cards as cards": same edge look as resources.
  - "Minimal motion": overlay fade, dice move, card rise.

`game-hud` and `hud-presentation` are still defined in unarchived changes (`client-3d`, `hud-tailwind-cards`, `dice-tray-3d`). Archive those first, in that order, before archiving this change.

## Impact

- **Engine** (`packages/engine`): `timeout` action and `timedOut` event in `state.ts`; resolution in a new `rules/timeout.ts`; `game.ts` dispatch. `legalActions` unchanged.
- **Protocol** (`packages/protocol`): version 3. `startGame.turnTimer`; `timer` field on `gameSnapshot` and `gameUpdate`. `ClientActionSchema` must keep rejecting `timeout`.
- **Server** (`apps/server`):
  - `rooms/room.ts`: arm, restart and fire a per-room timer that applies `timeout` through the normal action path;
  - room meta: preset and deadline persisted;
  - re-arm on rebuild after a restart;
  - `service.ts`: clock and timer injection for tests.
- **Client** (`apps/client`):
  - `hud/Hud.tsx`: new layout; `useHudLayout` and the dice dock change;
  - removed: `TurnBar.tsx`, `BuildBar.tsx`;
  - new: floating action buttons, edge hand, `TurnFocus` overlay, countdown hook;
  - also: `Hand.tsx`, `DevCards.tsx`, `GameCard.tsx` (peek layout), `DiceTray.tsx` (centered mode), `Lobby.tsx` (timer picker), the stores and `style.css`.
- **Tests:** HUD tests that use the turn bar or build bar move to the new buttons. New tests cover the engine timeout cases, the server timer (fake clock) and the client countdown and focus overlay.
- **No new dependencies.** The icons come from `lucide-react`, which is already used.
