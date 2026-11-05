// Hexfall service worker: turn notifications only (openspec change turn-sound-and-push;
// specs/turn-notifications "Service worker", "Push notification display", "Notification click").
// It never caches or intercepts requests: there is no fetch handler on purpose.

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

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
