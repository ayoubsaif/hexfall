## Decisions

- Runtime caching, not a build-time precache list: Vite hashes `/assets/*`, so those are immutable and cache-first is safe; unhashed static folders use stale-while-revalidate so updates arrive one visit later.
- Pages use network-first so a new deploy is picked up immediately; the cached `/` shell is only the offline fallback. Gameplay still needs the network (WebSocket).
- Install prompt is Chromium/Android only (`beforeinstallprompt`); iOS has no such event, so no button is shown there.
- Host HTTP cache headers are out of scope (client host config is not in this repo).
