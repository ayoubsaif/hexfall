// Hexfall service worker: turn notifications (openspec change turn-sound-and-push; specs/
// turn-notifications "Service worker", "Push notification display", "Notification click") and
// runtime caching for fast, offline-tolerant loads (openspec change pwa-install-and-offline-cache).
// Only same-origin GET requests are cached; sockets and cross-origin calls are never touched.

// Notification text; must match common.alerts.push in the i18n catalogs (a test checks it).
/* STRINGS */
const STRINGS = {
  en: {
    title: {
      turn: "Your turn — room {{room}}",
      setup: "Your turn — room {{room}}",
      rollForOrder: "Roll for order — room {{room}}",
      discard: "Discard — room {{room}}",
    },
    body: {
      turn: "Roll the dice.",
      setup: "Place your settlement and road.",
      rollForOrder: "Roll to decide who starts.",
      discard: "Discard half your cards.",
    },
  },
  es: {
    title: {
      turn: "Tu turno — sala {{room}}",
      setup: "Tu turno — sala {{room}}",
      rollForOrder: "Tira para el orden — sala {{room}}",
      discard: "Descarta — sala {{room}}",
    },
    body: {
      turn: "Tira los dados.",
      setup: "Coloca tu poblado y tu camino.",
      rollForOrder: "Tira para decidir quién empieza.",
      discard: "Descarta la mitad de tus cartas.",
    },
  },
};
/* END STRINGS */

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";
const CODE = /^[A-Z0-9]{1,16}$/;

// Bump to drop every old cache on the next activation.
const CACHE = "hexfall-v1";
const SHELL = ["/", "/manifest.webmanifest", ICON, "/icons/icon-512.png", "/favicon.ico"];
// Static files that rarely change but are not content-hashed: serve cached, refresh behind.
const SWR = /^\/(textures|themes|cards|avatars|ui|icons|fonts)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("hexfall-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

async function store(request, response) {
  if (response && response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

// Hashed build output never changes under the same name: cache first.
async function cacheFirst(request) {
  const hit = await caches.match(request);
  return hit || store(request, await fetch(request));
}

// Cached copy now, fresh copy for next time.
async function staleWhileRevalidate(event, request) {
  const hit = await caches.match(request);
  const fresh = fetch(request)
    .then((res) => store(request, res))
    .catch(() => hit);
  if (hit) {
    event.waitUntil(fresh);
    return hit;
  }
  return fresh;
}

// Pages: always try the network for the newest build, fall back to the cached shell offline.
async function networkFirst(request) {
  try {
    return await store(request, await fetch(request));
  } catch (error) {
    const hit = (await caches.match(request)) || (await caches.match("/"));
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
  } else if (SWR.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});

function text(lang, kind, room) {
  const base = String(lang || "en")
    .split("-")[0]
    .toLowerCase();
  const table = STRINGS[base] || STRINGS.en;
  const pick = (group) => (table[group] && table[group][kind]) || STRINGS.en[group][kind] || "";
  return {
    title: pick("title").replace("{{room}}", room),
    body: pick("body"),
  };
}

self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  const kind = data && STRINGS.en.title[data.kind] ? data.kind : "turn";
  const room = data && typeof data.room === "string" && CODE.test(data.room) ? data.room : "";
  const { title, body } = text(data && data.lang, kind, room);
  // Pushes are userVisibleOnly: always show something.
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: room ? `room-${room}` : "hexfall",
      renotify: true,
      icon: ICON,
      badge: BADGE,
      data: { room },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const room = event.notification.data && event.notification.data.room;
  const target = new URL(room ? `/?room=${encodeURIComponent(room)}` : "/", self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.filter((c) => new URL(c.url).origin === target.origin);
      const inRoom = same.find(
        (c) => room && (new URL(c.url).searchParams.get("room") || "").toUpperCase() === room,
      );
      if (inRoom) return inRoom.focus();
      for (const c of same) {
        try {
          const moved = await c.navigate(target.href);
          if (moved) return moved.focus();
        } catch {
          // Uncontrolled windows cannot be navigated; try the next one or open a new window.
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
