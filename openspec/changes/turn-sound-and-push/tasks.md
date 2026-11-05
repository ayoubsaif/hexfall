## 1. Icons, manifest and page metadata

- [x] 1.1 `git mv apps/client/public/faivon.png apps/client/brand/icon.png`
- [x] 1.2 Write `tools/icons.mjs` (sharp, already a tools dependency; ICO container written directly) producing `favicon.ico` (16/32/48), `icons/favicon-32.png`, `icons/apple-touch-icon.png`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/badge-96.png`, `og-image.png` (1200×630, < 300 KB); add root script `icons:build`
- [x] 1.3 Run the script, visually check each output, commit generated files
- [x] 1.4 Add `public/manifest.webmanifest` (name, short_name, start_url, scope, standalone, colors from `style.css` tokens, 192/512/maskable icons)
- [x] 1.5 Update `index.html`: icon links, apple-touch-icon, manifest link, theme-color, description, Open Graph and Twitter tags
- [x] 1.6 Add the `VITE_SITE_URL` `transformIndexHtml` plugin in `apps/client/vite.config.ts` (absolute image URLs, `og:url`, canonical only when set); test both cases on built HTML
- [x] 1.7 Extend `tools/check-assets.mjs` to assert icon files exist with correct PNG dimensions and that the source is not under `public/`

## 2. Audio engine and sounds

- [x] 2.1 `src/audio/engine.ts`: lazy `AudioContext` (injectable factory), master gain, unlock on first `pointerdown`/`keydown`, no-op when Web Audio is missing, drop plays while not running
- [x] 2.2 `src/audio/sounds.ts`: `chime()` and `diceRattle()` synthesized (shared noise buffer); `playSound(name)` seam honoring mute
- [x] 2.3 `src/store/prefs.ts`: persisted `{ sound, notify }` with try/catch `localStorage`
- [x] 2.4 Unit tests: engine with fake context (unlock, dropped plays, no Web Audio), prefs persistence and blocked storage

## 3. Sound triggers in the HUD

- [x] 3.1 Detect live rolls from the store write itself (`source === "update"` and a roll in the new `lastEvents`), the same condition under which `useDiceThrow` sees a new roll index; `useDiceThrow` unchanged
- [x] 3.2 `useGameAlerts()` plays `diceRattle` once per live roll (any seat, timer rolls included, reduced motion included, never on snapshot); mounted once via `GameAlerts` next to `TurnFocus`
- [x] 3.3 `useViewerWait()` selector (`rollForOrder` / `setup` / `turn` / `discard` / null) with tests against fixtures
- [x] 3.4 `useGameAlerts()` fires on null → wait transitions after the first view, not after game end; plays `chime` and calls the local notification fallback; mount once with `TurnFocus`
- [x] 3.5 `SoundToggle` next to `LanguageSwitch` with i18n labels (en/es) and tests (toggle, persisted state, accessible label)

## 4. Protocol v4

- [x] 4.1 Add `pushSubscribe`, `pushUnsubscribe`, `visibility` client messages and `welcome.pushKey` in `packages/protocol/src/messages.ts` with size limits
- [x] 4.2 Bump `PROTOCOL_VERSION` to 4; update codec/messages tests

## 5. Server push

- [x] 5.1 Config: optional all-or-none `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` → `config.push`; tests for none, all, partial
- [x] 5.2 Send `pushKey` in `welcome`
- [x] 5.3 `push/store.ts`: `PushStore` interface, memory and Redis (`push:{ROOM}` hash keyed by seat token hash, ≤3 per seat, dedupe by endpoint, room TTL) implementations with tests (memory always, Redis opt-in via TEST_REDIS=1)
- [x] 5.4 Handle `pushSubscribe` / `pushUnsubscribe` in the session/service (`no_seat`, `unavailable`); clear seat subscriptions when a lobby seat is freed and all on room deletion
- [x] 5.5 `Conn.visible` (true on join/resume) updated by `visibility`; never persisted or broadcast
- [x] 5.6 Add `web-push` dependency; `push/sender.ts` behind a `PushSender` interface (TTL from deadline or 3600 s, urgency high, topic = room, 10 s timeout, delete on 404/410, log other errors)
- [x] 5.7 `push/notify.ts`: newly waited seats (before `[]` at start) minus visible connections → kind → background sends; skip when game ended or push disabled
- [x] 5.8 Call it after broadcast in the action, timeout and start paths of `Room`
- [x] 5.9 Tests with fake sender: turn start while disconnected, visible seat gets nothing, discard after 7 only to discarders, timeout-driven turn start, 410 cleanup, sender failure does not affect the game, no push after win

## 6. Client notifications

- [x] 6.1 `public/sw.js`: `push` handler (en/es table, title/body per kind, tag = room, renotify, icon/badge) and `notificationclick` (focus room window → navigate any window → openWindow `/?room=CODE`); no fetch handler
- [x] 6.2 `src/notify/support.ts` feature detection and `register.ts` registration at startup (`main.tsx`)
- [x] 6.3 `src/notify/subscription.ts`: `ensureSubscribed(pushKey)` with key-mismatch resubscribe, `unsubscribe()`
- [x] 6.4 Store `pushKey` from `welcome` in the connection store
- [x] 6.5 `src/notify/sync.ts` (started from `main.tsx`; `onSeated` hook from the session): `pushSubscribe` on join/resume/language/key change when enabled; `visibility` on join/resume and `visibilitychange`; `pushUnsubscribe` on disable
- [x] 6.6 `src/notify/local.ts` fallback, used by `GameAlerts` only when enabled, granted, no active push subscription and document hidden
- [x] 6.7 `NotifyToggle` (off / on / blocked with settings hint; hidden when unsupported); permission requested only from the control; i18n en/es
- [x] 6.8 Tests: toggle states and no prompt on load, subscription sync messages, fallback only when push inactive, SW string table matches i18n keys

## 7. Docs and verification

- [x] 7.1 README + `.env.example`: VAPID variables, key generation, Fly secrets, `VITE_SITE_URL`, `pnpm icons:build`
- [x] 7.2 `pnpm test` passes; lint, check-engine and check-assets pass for this change (`pnpm check` still stops on 4 pre-existing unformatted files and a pre-existing type error in `packages/protocol/test/messages.test.ts`, not from this change)
- [ ] 7.3 Manual check in Chrome (server with real VAPID keys verified to start and send `pushKey`; browser flow still to do): chime and dice sound after first click, mute persists, enable notifications, close tab, get turn push from another player's end-turn, click opens and resumes; link preview tags present in built `index.html`
