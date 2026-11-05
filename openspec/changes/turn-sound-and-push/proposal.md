## Why

Players miss their turn. The only signal today is the your-turn overlay and a `● ` title prefix, both invisible when the player is in another tab, another app, or has closed the tab. With the turn timer on, a missed roll means the server plays for you after 30 s. Sound cues and notifications that reach the player outside the page close that gap, and a dice sound makes rolls readable without watching the board.

## What Changes

- **Turn chime**: a short synthesized sound plays when the viewer's turn (or another wait on the viewer, such as a discard) starts.
- **Dice sound**: a synthesized rattle plays for every new roll that arrives as a live update (any seat's roll, including timer rolls), never for snapshots (join, resume).
- **Sound settings**: a mute toggle in the HUD, remembered per browser. Sounds are generated with the Web Audio API — no audio files.
- **Web Push**: the client registers a service worker and, after the player opts in, subscribes with the server's VAPID public key and sends the subscription for its seat. When a seat starts being waited for and that seat has no connected, visible tab, the server sends a push. The service worker shows a localized notification ("Your turn in room ABCD"); clicking it focuses an open game tab or opens `/?room=CODE`.
- **Local notification fallback**: when push is unavailable (unsupported browser, server without VAPID keys) but notification permission is granted, the open tab shows a `Notification` itself while hidden.
- **Notification settings**: a HUD control to enable/disable notifications (permission is requested only from that control, never on load).
- **Protocol**: new client messages `pushSubscribe`, `pushUnsubscribe`, `visibility`; `welcome` gains `pushKey` (VAPID public key or null). **BREAKING** for wire compatibility: `PROTOCOL_VERSION` goes from 3 to 4 (old clients get `version_mismatch` and reload).
- **Server config**: optional `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Without them push is off and everything else still works.
- A minimal web app manifest so the game can be installed (required for Web Push on iOS Safari).
- **Icons, SEO and social previews**: the hex mountain artwork (`apps/client/public/faivon.png`, 1000×1000) becomes the app icon. A script derives the favicon set (`favicon.ico` + 32 px PNG), Apple touch icon, manifest icons (192, 512, maskable 512), a monochrome notification badge, and a 1200×630 Open Graph image. `index.html` gains description, theme color, Open Graph and Twitter card tags. The 180 KB source moves out of `public/` so it is no longer shipped.

## Capabilities

### New Capabilities
- `game-audio`: synthesized turn chime and dice sound, when each plays, audio unlock after a user gesture, and the persisted mute setting.
- `turn-notifications`: client side of notifications — opt-in flow, service worker, push subscription lifecycle, notification content and click behavior, and the local-notification fallback.
- `web-metadata`: app icons (favicon, Apple touch, manifest, notification icon/badge), web app manifest, and the SEO / Open Graph / Twitter tags in `index.html`.

### Modified Capabilities
- `game-server`: adds push subscription storage per seat, per-connection visibility reporting, the rule for when a push is sent (seat newly awaited and no visible connection), VAPID configuration, and the protocol version bump.

## Impact

- **Client** (`apps/client`): new `src/audio/` (Web Audio synth + sound hooks), new `src/notify/` (permission, service worker registration, subscription, fallback), `public/sw.js`, `public/manifest.webmanifest`, `index.html` manifest link, HUD settings controls next to `LanguageSwitch`, hooks wired into `TurnFocus`/`useTurnFocus` and `DiceTray`/`useDiceThrow`, new i18n keys (en, es).
- **Protocol** (`packages/protocol`): new messages, `welcome.pushKey`, `PROTOCOL_VERSION` 4.
- **Server** (`apps/server`): new `push/` module (subscription store in Redis with room TTL, sender using `web-push`), hooks after each accepted action and timeout using existing `waitingSeats`, visibility tracking per connection, config parsing.
- **Assets/tooling**: `tools/icons.mjs` (+ `pnpm icons:build`) generating `apps/client/public/icons/*`, `favicon.ico` and `og-image.png` from `apps/client/brand/icon.png` with sharp; outputs are committed. New optional client build var `VITE_SITE_URL` for absolute `og:url` / `og:image`.
- **Dependencies**: `web-push` (server). No new client dependency.
- **Ops**: generate VAPID keys once (`npx web-push generate-vapid-keys`), set them as Fly secrets; document in README and `.env.example`.
- **Engine**: no change. Rules untouched.
