## Context

- The client (`apps/client`) has a framework-free `Connection` class (hello/ping, reconnect with backoff, version mismatch), a ref-counted `useConnection`, zustand stores (`connection`, a placeholder `game`), the theme layer (asset keys, procedural fallbacks, Flat/3D style, land relief), and a board view that draws a `Board` (tiles, sea, tokens, harbors, robber) through the pure `boardLayout`. The HUD shows only the connection badge, the reload banner and the style switch.
- The server speaks protocol v2 (archived `game-server` design, decision 1). Its behaviors that shape the client:
  - Every accepted action sends a `gameUpdate` to every connected seat, including the sender. So the update itself is the acknowledgement.
  - `leaveRoom` works only in the lobby.
  - A connection that already holds a seat gets `already_in_room` on another create, join or resume.
  - `resumeRoom` answers an unknown room with `bad_token`.
  - Close code 4001 means another connection resumed this seat.
- The scaffold rule still applies (scaffold design decision 6): the client imports engine types from the root and runtime code only from `@hexfall/engine/geometry`. The client never runs the reducer or legality code.
- `aurora-background` (pending, 0/1 tasks) also edits `apps/client/src/style.css`.

## Goals / Non-Goals

**Goals:**
- All game logic shown to the player comes from pure functions over `(view, legal, ui state)`, so it can be unit-tested without WebGL or sockets.
- One place decides the current board pick. Board and HUD both read it, so they never disagree.
- The network layer stays testable with the existing fake socket.

**Non-Goals:**
- Domestic trade UI. `offers` in the view are ignored.
- Client-side prediction or optimistic updates.
- WebGL rendering tests. The scene is checked through pure layout and pick models, plus manual play.

## Decisions

### 1. Module layout and ownership

```
apps/client/src/
  net/connection.ts   + Replaced (4001) handling, restart(); generic, protocol-agnostic otherwise
  net/session.ts      NEW  SessionController: auto-resume on welcome, routes room/game messages
                           into stores, intents (create/join/leave/start/act), log-gap recovery
  net/seatStorage.ts  NEW  saved seats + last room (localStorage, try/catch, memory fallback)
  net/address.ts      NEW  read/write ?room=CODE, build invite links
  net/bindStore.ts    connection listener -> stores (now also forwards messages to the session)
  store/room.ts       NEW  room code, own seat, host, seats, status, notice, form errors
  store/game.ts       real game store: version, view, legal, log, inFlight
  store/ui.ts         NEW  chosen build, victim choice, open dialog, toasts
  game/pick.ts        NEW  pure: currentPick(view, legal, ui) -> Pick | null
  game/status.ts      NEW  pure: "waiting for" text, control enablement
  game/describe.ts    NEW  pure: event -> log line; event -> toast (for a viewer)
  game/colors.ts      NEW  seat colors (palette + names)
  game/cards.ts       NEW  pure helpers: hand totals, discard/YoP/maritime validation
  scene/Pieces.tsx    NEW  roads/settlements/cities from view.vertices/edges
  scene/Targets.tsx   NEW  highlight + hit meshes for the current pick
  scene/motion.ts     NEW  drop/tween/glow timing, reduced-motion aware
  scene/Scene.tsx     preview board <-> live board switch
  hud/*               NEW  StartScreen, Lobby, PlayerPanels, Hand, TurnBar, Dice, BuildBar,
                           DevCards, DiscardDialog, YearOfPlentyDialog, MonopolyDialog,
                           VictimDialog, MaritimePanel, EventLog, Toasts, Rejection, GameOver,
                           ReplacedNotice; Hud.tsx is the layout shell
```

Ownership for parallel work (the user prefers several agents with separate files):

| Owner | Files |
|---|---|
| lead | `store/*`, `game/pick.ts`, `game/colors.ts`, `App.tsx`, `Hud.tsx` shell, engine `geometry.ts` exports, `style.css` merge, `tasks.md` |
| net agent | `net/*`, `test/net/*` |
| board agent | `scene/*`, `test/scene/*` |
| HUD agent | `hud/*` (except the shell), `game/status.ts`, `game/describe.ts`, `game/cards.ts`, `test/hud/*`, `test/game/*` |

The lead writes the store shapes and `Pick` type first (task group 1). The other three groups then run in parallel against them.

### 2. Stores: server truth vs. UI intent

- `game` and `room` are written only by `net/session.ts`. The game store applies the version and log-length checks from the spec ("Game store mirrors the server"). `inFlight` becomes true when `act()` sends. It becomes false on `gameUpdate`, `actionRejected`, an `error` reply to a `gameAction`, or a disconnect.
- `ui` holds only player intent: the chosen build (`"road" | "settlement" | "city" | null`), the robber hex waiting for a victim, the open dialog, and toasts. It is cleared when the view changes phase or turn, so a stale intent never survives a server change.
- *Alternative*: one big store. Rejected because separate stores keep the rule "only the network writes server state" easy to check with a test and a lint-like grep.

### 3. One pick function

`currentPick(view, legal, ui)` returns `{ kind, targets }` or null. `kind` is one of `placeSettlement`, `placeRoad`, `buildSettlement`, `buildRoad`, `buildCity` or `moveRobber`, and `targets` is a set of vertex, edge or hex ids.

- Setup: `placeSettlement` or `placeRoad` whenever that legal list is non-empty.
- `moveRobber` phase: the robber hexes from `legal.moveRobber`.
- `roadBuilding` phase: `buildRoad` from `legal.buildRoad`.
- Main turn: only when `ui.build` is set, using the matching legal list. If that list is now empty, the pick is null and the build is cleared.

`Targets.tsx` draws highlights and hit areas from it. `BuildBar` and `TurnBar` use it to show Cancel and the "pick a spot" hint. The board sends the action through `session.act()` and the pick ends because `ui.build` is cleared and `inFlight` disables picking. The phase change from the server then removes the targets for good.

### 4. Picking in R3F

- Hit areas are invisible meshes created only for legal targets:
  - Vertices: discs (radius about 0.18) at `vertexPosition`.
  - Edges: thin boxes at `edgeMidpoint` rotated by its `angle`.
  - Hexes: the hex outline.
- All of these sit at land height from `useLandRelief`. Fewer meshes means cheap raycasting and no accidental picks on illegal spots.
- Click vs. drag: R3F's `event.delta` (pointer travel in pixels) above 6 px means a camera drag, which is ignored. This is the same for touch.
- Hover uses `onPointerOver`/`onPointerOut` with `stopPropagation`, plus a `cursor: pointer` on the canvas.
- *Alternative*: a manual raycast against the whole board with a nearest-target search. Rejected as more code, and harder to keep in sync with relief heights.

### 5. Pieces and colors

- `Pieces.tsx` maps `view.vertices` and `view.edges` to `<Asset assetKey="piece.*" playerColor={SEAT_COLORS[owner]} />`. Positions come from `vertexPosition` and `edgeMidpoint` (already exported from geometry). Roads are rotated by `-angle` around Y, so the model's local X lies along the path (asset-theming model contract).
- Seat colors are fixed per seat: red-orange, blue, white/cream, and a dark violet. They are chosen for contrast against the terrain art and the sea, and checked with a deuteranopia/protanopia simulation. Each color also has a name for screen readers and the log.
- Keys use stable ids (`v12`, `e40`), so React keeps instances. A new key is a new piece, which lets the drop animation run only for new pieces.

### 6. Motion

- `motion.ts` exports durations and a `useReducedMotion()` hook (matchMedia, reactive).
- The drop is a 300 ms ease-out from y+0.6 in `useFrame`. The robber tween is 450 ms along the straight line with a small arc. Production glow is a 1.2 s emissive pulse on the token of each producing hex.
- Snapshot vs. update: the session stamps each store write with `source: "snapshot" | "update"`. Pieces present in a snapshot mount without animation.
- Under reduced motion, every duration is 0. The dice reveal and toasts use CSS transitions that are disabled by a `prefers-reduced-motion` media query.

### 7. Session flow (`net/session.ts`)

- On `welcome`, the session picks a seat to resume: the `?room=` code in the address if a seat is saved for it, otherwise the last room used. It then sends `resumeRoom`. Otherwise it shows the start screen. If the address has a code with no saved seat, the join form is prefilled.
- On `roomJoined` with a token, it saves the seat, sets the address to `?room=CODE` (`history.replaceState`), and records the last room.
- On a `bad_token` reply to a resume, it forgets the seat, clears the stores and sets a notice.
- On a log gap, the session calls `connection.restart()`. This closes the socket and opens a new one at once without backoff. The normal welcome → resume path then reloads the snapshot.
- Close code 4001: `Connection` sets status `"replaced"` and stops. "Play here" calls `restart()`.
- Game over → "back to start": the session forgets the seat, clears `?room=` and the stores, then calls `restart()`. The new connection holds no seat, so create and join work again.
- `Connection` stays protocol-agnostic apart from hello/ping. The session gets every message through the listener's `message` callback.

### 8. Engine geometry exports

The HUD needs build costs and the resource list. `COSTS` and `RESOURCES` are plain data. `geometry.ts` will re-export them from `rules/common.ts`, with a test that checks the file still exports no functions that touch state. Everything else the client needs (vertex and edge positions, `TOPOLOGY`) is already exported.

### 9. HUD layout

- Desktop:
  - Player panels across the top.
  - Event log on the right.
  - Hand and dev cards at the bottom.
  - Turn bar with dice and actions at bottom center.
  - Build bar beside the turn bar.
  - Maritime panel as a pop-over from the build bar.
- Narrow screens (smaller side under 768 px):
  - Panels collapse to compact chips.
  - The log becomes a drawer.
  - Hand and actions stack at the bottom.
- Dialogs (discard, Year of Plenty, Monopoly, victim) are modal over the HUD but leave the board visible. The discard dialog cannot be dismissed.
- All HUD controls are real buttons with labels. Toasts use `aria-live="polite"` and rejections use `role="alert"`.

### 10. Event text

`describe(event, viewer, names)` returns `{ text, seats[] }` for every `GameEvent` variant. A test runs over every variant, so a new engine event without a line fails the build. Redacted fields (`resource: null`, `card: null`) produce the hidden wording. Toasts come from a second function, `toastFor(event, viewer)`, that returns null for events that are not key events.

## Risks / Trade-offs

- [The HUD is large and the spec lists many controls] → The logic (pick, status, enablement, validation, event text) lives in pure modules with tests. Components are thin. Manual play with 3 browser tabs is still required before archive.
- [The in-flight lock could stick if a reply is lost] → It clears on any `gameUpdate`, `actionRejected`, `error`, disconnect or snapshot. A 10 s safety timeout also clears it and logs a warning.
- [Raised isometric style and picking heights disagree] → Hit meshes read the same `useLandRelief` value as the tiles. A layout test checks targets sit at the land top for both styles.
- [Merge conflict with `aurora-background` in `style.css`] → The lead owns `style.css`. New HUD styles go in `hud/hud.css`, imported by `Hud.tsx`, so `style.css` only needs small edits.
- [Seat colors clash with the AI terrain art] → Colors are tokens in one module, easy to tune after a visual check. Pieces also get a dark outline (an edge-darkening material) for contrast.
- [Rules that only the server knows, e.g. why a target is illegal] → The client shows legal targets only and does not explain illegal ones. Rejections show the server message.

## Migration Plan

Client and server are built together from one repo, so there is no wire migration. The client already reports protocol v2 through the shared package. Saved seats are new data. If a stored value is malformed it is discarded.
