## Why

On Android the game opens as a browser tab and reloads every asset on each visit. Offering a one-tap install on the first page and caching static files makes it start faster and feel like an app.

## What Changes

- The welcome page shows an "Install the app" button when the browser fires `beforeinstallprompt` and the app is not already installed.
- The service worker gains a fetch handler: cache-first for hashed `/assets/`, stale-while-revalidate for textures, themes, cards, avatars, UI images, icons and fonts, network-first with cached shell fallback for navigations. Same-origin GET only; `sw.js` and sockets are never intercepted.
- Cache name is versioned; old `hexfall-*` caches are deleted on activation.

## Impact

- Supersedes the "no fetch handler" rule of `turn-sound-and-push`.
- Affects `apps/client/public/sw.js`, `apps/client/src/pwa/install.ts`, `Welcome.tsx`, i18n (en, es).
