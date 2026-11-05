## Context

- The client (`apps/client`) is a static React + three.js SPA, hosted separately from the server (any static host). The server (`apps/server`) is a Node WebSocket server on Fly.io with Redis as source of truth.
- Turn awareness today: `useTurnFocus` opens the your-turn overlay when `legal.rollDice || legal.rollForOrder` flips to true; `TurnFocus` prefixes the title with `● ` while hidden. `useDiceThrow` decides when a roll animates (`source === "update"`, new `roll.index`). No sound, no notifications.
- Server: `RoomService`/`Room` hold one `Conn` per seat (`room.conns[seat]`). `rooms/timer.ts` already has `waitingSeats(state)` (the seats the game waits for) used by the turn timer. Every accepted action and timeout goes through one serialized, persist-then-broadcast path.
- Protocol: zod-validated envelopes, `PROTOCOL_VERSION = 3`; a mismatch makes the client show a reload banner.
- Icon art exists at `apps/client/public/faivon.png` (1000×1000 RGBA, typo in name) but is unused; `index.html` has only a `<title>`.

## Goals / Non-Goals

**Goals:**
- Audible turn and dice cues with zero asset weight and a mute toggle.
- Reach a player whose tab is hidden or closed when the game starts waiting on them, without double alerts.
- Push is optional infrastructure: no VAPID keys → everything else works.
- Proper favicon, installable manifest, and link previews.

**Non-Goals:**
- Offline mode or asset caching in the service worker.
- Sounds for other events (builds, trades, robber) — easy to add later on the same synth module.
- Volume slider, per-sound toggles, custom sound themes.
- Email/SMS or native app push.
- Alerting spectators or players without a seat.

## Decisions

### 1. Sounds are synthesized with Web Audio, in `src/audio/`
`audio/engine.ts` owns a lazy `AudioContext` and a master `GainNode`; `audio/sounds.ts` defines `chime()` (two sine/triangle notes, e.g. E5→A5, fast attack, ~600 ms exponential decay) and `diceRattle()` (8–12 short band-passed noise bursts over ~900 ms with jittered timing and decreasing gain, matching `THROW_MS = 980`). A noise `AudioBuffer` is created once and reused.
- *Why over audio files*: no licensing, no loading, no theme coupling, ~2 KB code. Chosen by the user.
- *Unlock*: one `pointerdown`/`keydown` listener on `document` calls `ctx.resume()`; it removes itself once `ctx.state === "running"`. A play request while not running is dropped (spec: no queued sounds).
- *Testability*: the engine takes an injectable `AudioContext` factory; tests use a fake that records calls. Sound triggers are tested through a `playSound(name)` seam that is mocked in HUD tests.

### 2. Sound triggers reuse the existing HUD signals
- **Dice**: a `useDiceSound()` hook watches the same `roll.index` + `source === "update"` condition as `useDiceThrow`, but ignores reduced motion. Put the "new live roll" detection in one helper shared by both hooks so they can never disagree.
- **Turn chime**: a new `useViewerWait()` selector returns the current wait kind for the viewer or null: `rollForOrder`, `setup` (setup placement legal), `turn` (`rollDice` legal), `discard` (discard owed). A `useTurnAlert()` hook fires on null → non-null transitions only after the first view (a ref initialised on mount skips snapshots), and not when `view.winner !== null`. It calls `chime()` and, when applicable, the local notification fallback. The overlay's own trigger (`useRollWait`) is untouched.
- *Alternative considered*: chime inside `useTurnFocus`. Rejected: the focus only covers roll waits, and the notification needs the same trigger for discards/setup.

### 3. Settings live in a small persisted store
`store/prefs.ts` (zustand) holds `{ sound: boolean, notify: boolean }`, read/written through try/catch `localStorage` (`hexfall.prefs`). HUD gets `SoundToggle` (Volume2 / VolumeX lucide icons) and `NotifyToggle` (Bell / BellOff / BellRing-with-slash for blocked) placed with `LanguageSwitch`. Mute is applied at the master gain and in `playSound` (early return).

### 4. Push architecture: server decides, service worker only displays
```
 client tab ──ws──► server ──web-push──► push service ──► sw.js ──► Notification
   │ pushSubscribe{sub,lang}         ▲
   │ visibility{visible}             │ after persist+broadcast:
   └─────────────────────────────────┘ newly waited seats w/o visible conn
```
- The server already knows who it waits for (`waitingSeats`) and who is connected; adding per-connection visibility lets it avoid pushing to a player looking at the game. This keeps one source of alerts and avoids the duplicate problem of "push + local".
- *Alternative*: always push, let the SW suppress when a visible client exists. Rejected: Chrome penalizes `userVisibleOnly` pushes that show nothing, and it wastes push traffic.
- *Alternative*: local `Notification` only. Rejected by the user: it cannot reach a closed tab.

### 5. Server push module `apps/server/src/push/`
- `config.ts` additions: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, all-or-none (zod `superRefine`). `Config.push: { publicKey, privateKey, subject } | null`.
- `push/store.ts`: `PushStore` interface with `add(room, seat, sub)`, `remove(room, seat, endpoint)`, `list(room, seat)`, `clearSeat`, `clearRoom`; Redis impl uses a hash `push:{ROOM}` whose field is the seat's token hash (stable when lobby seats are renumbered after a leave), value = JSON array (≤3, newest last), `EXPIRE` refreshed to the room TTL (14 d) on write; memory impl for tests. Kept separate from `RoomStore` so the persistence contract tests stay unchanged.
- `push/sender.ts`: wraps `web-push` `sendNotification` behind a `PushSender` interface (fake in tests), sets `TTL` (deadline-based, else 3600 s), `urgency: "high"`, `topic` = room code (collapses older undelivered pushes for that room on the push service). 404/410 → `remove`. Timeout 10 s. Errors logged, never thrown into the room path.
- `push/notify.ts`: `waitsChanged({room, before, after, holders, visible, deadline, now})` computes `newly = waitingSeats(after) − waitingSeats(before)` (before = `[]` at game start), filters out seats whose conn exists and is visible, maps each to a kind via the same rules as the client (`rollForOrder` / `setup` / `turn` / `discard`), and fires `queueMicrotask`/`void promise` sends. Called through an optional `RoomDeps.waitsChanged` hook after broadcast in the action, timeout and start paths; `RoomDeps.seatLeft` and `deleted` clear subscriptions. Skipped if `after.winner !== null` or push disabled.
- `Conn` gains `visible: boolean` (default true on join/resume); `visibility` message updates it. Not persisted, not broadcast.
- Payload (JSON, small): `{ v: 1, kind, room, lang }`. Text is built in the service worker so the server stays language-agnostic beyond echoing the stored `lang`.

### 6. Protocol changes (v4)
- Client → server: `pushSubscribe { subscription: { endpoint: https url ≤1024, keys: { p256dh, auth } (base64url ≤256) }, lang: "en"|"es"|string≤8 }`, `pushUnsubscribe { endpoint }`, `visibility { visible: boolean }`.
- Server → client: `welcome.payload.pushKey: string | null`.
- Responses: `pushSubscribe`/`pushUnsubscribe` reply `ok`-less (fire and forget) except errors `no_seat` / `unavailable`; `visibility` never replies. Rate limits already cover these.
- Bump `PROTOCOL_VERSION` to 4; deploy client and server together (README already requires this).

### 7. Client notification module `src/notify/`
- `support.ts`: feature detection (`"Notification" in window`, `"serviceWorker" in navigator`, `"PushManager" in window`).
- `sw-register.ts`: registers `/sw.js` on load in production builds and in dev (Vite serves `public/` as-is). Plain JS file in `public/` — no build plugin, no workbox. The SW contains its own tiny en/es string table and the click handler (`clients.matchAll({type:"window", includeUncontrolled:true})`, match `?room=CODE`, else `navigate`/`openWindow`).
- `subscription.ts`: `ensureSubscribed(pushKey)` — `registration.pushManager.getSubscription()`; if its `applicationServerKey` differs from `pushKey`, unsubscribe; then `subscribe({ userVisibleOnly: true, applicationServerKey })`; returns the JSON. A `useNotifySync()` hook (mounted with the game session) sends `pushSubscribe` on join/resume/language change, `visibility` on join/resume and `visibilitychange`.
- `local.ts`: fallback `new Notification(title, { body, tag: room, icon, badge })` with `onclick = () => { window.focus(); n.close(); }`; used only when `notify && permission === "granted" && !pushActive && document.hidden`.
- Strings for HUD controls and the local fallback come from i18n (`play.alerts.*`); the SW duplicates the notification strings (it cannot import the bundle). A unit test asserts the SW table and the i18n keys match.

### 8. Icons and metadata
- Move `public/faivon.png` → `apps/client/brand/icon.png` (git mv; out of `public/` so it is not shipped).
- `tools/icons.mjs` uses `sharp` (already a `tools` dependency, used by `cards:build`), so no system ImageMagick is needed; `favicon.ico` is written as an ICO container of PNGs. Sizes live in dependency-free `tools/icon-list.mjs`, shared with `check-assets`. Outputs into `apps/client/public/`: `favicon.ico` (16/32/48), `icons/favicon-32.png`, `icons/apple-touch-icon.png` (180, artwork at ~88 % on the app background color), `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png` (artwork at 70 % on background, inside the 80 % circular safe zone), `icons/badge-96.png` (alpha → white silhouette), `og-image.png` (1200×630: background gradient in app colors, icon ~460 px left, "Hexfall" wordmark right, `-strip`, quantized PNG to stay < 300 KB). Outputs committed; script added as `pnpm icons:build`. Follows the existing `tools/*.mjs` + `cards:build` pattern.
- `public/manifest.webmanifest` static; colors taken from the HUD theme tokens in `style.css` (resolved during implementation).
- `index.html`: static tags for icons, manifest, theme-color, description, `og:type/site_name/title/description/image*`, `twitter:*`. A small inline Vite plugin in `vite.config.ts` (`transformIndexHtml`) rewrites `og:image`/`twitter:image` to absolute and injects `og:url` + canonical when `VITE_SITE_URL` is set; otherwise leaves root-relative images and injects nothing. Avoids Vite's `%VITE_X%` syntax, which would leave literal placeholders when unset.
- `tools/check-assets.mjs` (already in `pnpm check`) extended to assert icon files exist with the right dimensions (PNG header read, no ImageMagick needed).

## Risks / Trade-offs

- [iOS Safari supports Web Push only for installed home-screen apps (16.4+)] → manifest + apple-touch-icon make install possible; the toggle shows "blocked/unsupported" honestly when `PushManager` is missing; local fallback covers the open tab.
- [Visibility can be stale: a laptop sleeps with the tab "visible", so no push is sent] → acceptable; the socket usually drops on sleep, which clears the connection and re-enables pushes. Could later add a short grace push if the seat does not act within N s.
- [Push subscriptions are tied to a seat token, not a user account; a shared device could get another player's alerts] → subscriptions are stored per room+seat and removed on unsubscribe, seat free, room deletion and 404/410; at most 3 per seat.
- [`web-push` adds crypto work per send on the game server] → at most one push per newly waited seat per action; sends are async and off the action path.
- [Autoplay policies drop the first chime after a reload] → by design (spec); the overlay and title marker still show.
- [Committed generated images can drift from source] → single script regenerates all; `check-assets` validates presence and sizes.
- [Protocol bump forces a reload for open clients during deploy] → existing version-mismatch banner handles it; deploy client and server together.

## Migration Plan

1. Generate VAPID keys once: `npx web-push generate-vapid-keys`; `fly secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:…`. Add placeholders to `.env.example` and the README env table, plus `VITE_SITE_URL` for the client build.
2. Deploy server and client together (protocol v4).
3. Rollback: redeploy the previous pair. Stored `push:*` keys are ignored by the old server and expire with the room TTL. Unsetting the VAPID secrets disables push without a code rollback.

## Open Questions

- Exact chime timbre and dice rattle feel — tune by ear during implementation.
- Production site origin for `VITE_SITE_URL` (client host not fixed in repo yet; Fly only hosts the server).
