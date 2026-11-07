## 1. Install prompt

- [x] 1.1 `src/pwa/install.ts`: capture `beforeinstallprompt`, `appinstalled`, `promptInstall`, `useCanInstall`; hide when standalone
- [x] 1.2 Install button on the welcome page; i18n `session.welcome.install` (en, es)
- [x] 1.3 Test: button hidden until the event, prompts on click, hides after

## 2. Caching

- [x] 2.1 Service worker fetch handler: cache-first `/assets/`, stale-while-revalidate static folders, network-first navigations with cached shell fallback
- [x] 2.2 Precache shell on install; versioned cache cleanup on activate
- [x] 2.3 Update the service-worker test to assert same-origin GET only and `sw.js` excluded
- [ ] 2.4 Check on an Android phone: install button, offline reload of the shell, second-visit speed
