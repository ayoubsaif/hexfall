// Turn notifications on the client (specs/turn-notifications).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import swSource from "../../public/sw.js?raw";
import { i18n } from "../../src/i18n/index.ts";
import { en, es } from "../../src/i18n/locales/index.ts";
import { showLocalTurnNotice } from "../../src/notify/local.ts";
import { useNotifyStore } from "../../src/notify/store.ts";
import { keyBytes } from "../../src/notify/subscription.ts";
import {
  disableNotifications,
  enableNotifications,
  onSeated,
  setNotifyDeps,
  syncPush,
} from "../../src/notify/sync.ts";
import { NotificationsSection as NotifyToggle } from "../../src/settings/sections/NotificationsSection.tsx";
import { useConnectionStore } from "../../src/store/connection.ts";
import { DEFAULT_PREFS, usePrefsStore } from "../../src/store/prefs.ts";
import { click, mount, resetAll, seatRoom, type Mounted } from "../hud/helpers.tsx";

const KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

/** Notification stand-in with a settable permission. */
class FakeNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  static shown: { title: string; options: NotificationOptions }[] = [];
  onclick: (() => void) | null = null;
  constructor(title: string, options: NotificationOptions) {
    FakeNotification.shown.push({ title, options });
  }
  close() {}
}

function fakePush() {
  let current: PushSubscription | null = null;
  const unsubscribe = vi.fn(async () => {
    current = null;
    return true;
  });
  const make = (key: ArrayBuffer): PushSubscription =>
    ({
      endpoint: "https://push.example.com/me",
      options: { applicationServerKey: key },
      toJSON: () => ({
        endpoint: "https://push.example.com/me",
        keys: { p256dh: "pk", auth: "au" },
      }),
      unsubscribe,
    }) as unknown as PushSubscription;
  const pm = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async (o: PushSubscriptionOptionsInit) => {
      current = make((o.applicationServerKey as Uint8Array).buffer as ArrayBuffer);
      return current;
    }),
  };
  return { pm: pm as unknown as PushManager, raw: pm, unsubscribe };
}

let sent: { type: string; payload: unknown }[] = [];
let m: Mounted | undefined;

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
}

beforeEach(() => {
  resetAll();
  sent = [];
  FakeNotification.permission = "default";
  FakeNotification.requestPermission.mockClear();
  FakeNotification.shown = [];
  vi.stubGlobal("Notification", FakeNotification);
  vi.stubGlobal("PushManager", function PushManager() {});
  usePrefsStore.setState({ ...DEFAULT_PREFS });
  useNotifyStore.setState({ permission: "default", pushActive: false });
  setNotifyDeps({
    send: ((type: string, payload: unknown) => {
      sent.push({ type, payload });
      return true;
    }) as never,
    pushManager: async () => null,
  });
});
afterEach(() => {
  m?.unmount();
  m = undefined;
  vi.unstubAllGlobals();
  setHidden(false);
  resetAll();
});

describe("Notifications section (specs/turn-notifications 'Notification opt-in')", () => {
  const btn = () =>
    m!.container.querySelector<HTMLButtonElement>('[data-testid="settings-notify"]');
  const status = () =>
    m!.container.querySelector<HTMLElement>('[data-testid="settings-notify-status"]')?.dataset
      .status;

  it("No prompt on load", () => {
    m = mount(<NotifyToggle />);
    expect(status()).toBe("off");
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it("Enable notifications: asks, then shows on", async () => {
    FakeNotification.requestPermission.mockImplementationOnce(async () => {
      FakeNotification.permission = "granted";
      return "granted";
    });
    m = mount(<NotifyToggle />);
    await act(async () => {
      click(btn());
      await syncPush();
    });
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(usePrefsStore.getState().notify).toBe(true);
    expect(status()).toBe("on-tab-only");
    expect(btn()?.getAttribute("aria-checked")).toBe("true");
  });

  it("Permission denied: blocked with the settings hint, no further prompt", async () => {
    FakeNotification.requestPermission.mockImplementationOnce(async () => {
      FakeNotification.permission = "denied";
      return "denied";
    });
    m = mount(<NotifyToggle />);
    await act(async () => {
      click(btn());
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(status()).toBe("blocked");
    expect(btn()?.disabled).toBe(true);
    expect(m!.container.textContent).toMatch(/blocked/i);
    await act(async () => click(btn()));
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("is hidden without Notification and service worker support", () => {
    vi.stubGlobal("Notification", undefined);
    const nav = navigator as unknown as { serviceWorker?: unknown };
    const had = "serviceWorker" in navigator;
    const saved = nav.serviceWorker;
    if (had)
      Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
    try {
      useNotifyStore.setState({ permission: "unsupported" });
      m = mount(<NotifyToggle />);
      expect(btn()).toBeNull();
      expect(status()).toBe("unsupported");
    } finally {
      if (had)
        Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: saved });
    }
  });
});

describe("push subscription sync (specs/turn-notifications 'Push subscription')", () => {
  function ready(push = fakePush()) {
    FakeNotification.permission = "granted";
    usePrefsStore.setState({ notify: true });
    useConnectionStore.setState({ pushKey: KEY });
    setNotifyDeps({ pushManager: async () => push.pm });
    seatRoom(1);
    return push;
  }

  it("Resume re-sends the subscription and the visibility", async () => {
    ready();
    setHidden(true);
    await onSeated();
    expect(sent.map((s) => s.type)).toEqual(["visibility", "pushSubscribe"]);
    expect(sent[0]!.payload).toEqual({ visible: false });
    expect(sent[1]!.payload).toEqual({
      subscription: { endpoint: "https://push.example.com/me", keys: { p256dh: "pk", auth: "au" } },
      lang: "en",
    });
    expect(useNotifyStore.getState().pushActive).toBe(true);
  });

  it("Server without push: no subscription", async () => {
    const push = ready();
    useConnectionStore.setState({ pushKey: null });
    await onSeated();
    expect(sent.map((s) => s.type)).toEqual(["visibility"]);
    expect(push.raw.subscribe).not.toHaveBeenCalled();
    expect(useNotifyStore.getState().pushActive).toBe(false);
  });

  it("re-subscribes when the server key changes", async () => {
    const push = ready();
    await syncPush();
    expect(push.raw.subscribe).toHaveBeenCalledTimes(1);
    await syncPush();
    expect(push.raw.subscribe).toHaveBeenCalledTimes(1); // same key: reused
    useConnectionStore.setState({ pushKey: KEY.replace(/^BE/, "BF") });
    await syncPush();
    expect(push.unsubscribe).toHaveBeenCalledTimes(1);
    expect(push.raw.subscribe).toHaveBeenCalledTimes(2);
  });

  it("Turn off: pushUnsubscribe and browser unsubscribe", async () => {
    const push = ready();
    await syncPush();
    sent = [];
    await disableNotifications();
    expect(sent).toEqual([
      { type: "pushUnsubscribe", payload: { endpoint: "https://push.example.com/me" } },
    ]);
    expect(push.unsubscribe).toHaveBeenCalled();
    expect(usePrefsStore.getState().notify).toBe(false);
  });

  it("enableNotifications does not prompt when already granted", async () => {
    ready();
    usePrefsStore.setState({ notify: false });
    await enableNotifications();
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
    expect(usePrefsStore.getState().notify).toBe(true);
  });

  it("decodes base64url keys", () => {
    expect(Array.from(keyBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
});

describe("local fallback (specs/turn-notifications 'Local notification fallback')", () => {
  beforeEach(() => {
    FakeNotification.permission = "granted";
    usePrefsStore.setState({ notify: true });
    seatRoom(0);
  });

  it("Push unavailable, tab hidden: one notification", () => {
    setHidden(true);
    expect(showLocalTurnNotice("turn")).toBe(true);
    expect(FakeNotification.shown).toEqual([
      {
        title: "Your turn — room K7QX2M",
        options: expect.objectContaining({ body: "Roll the dice.", tag: "K7QX2M" }),
      },
    ]);
  });

  it("Push active, tab hidden: nothing from the page", () => {
    setHidden(true);
    useNotifyStore.setState({ pushActive: true });
    expect(showLocalTurnNotice("turn")).toBe(false);
  });

  it("visible tab or notifications off: nothing", () => {
    expect(showLocalTurnNotice("turn")).toBe(false);
    setHidden(true);
    usePrefsStore.setState({ notify: false });
    expect(showLocalTurnNotice("discard")).toBe(false);
    expect(FakeNotification.shown).toEqual([]);
  });
});

describe("service worker strings", () => {
  it("match the i18n catalogs (common.alerts.push)", () => {
    const json = /\/\* STRINGS \*\/\s*const STRINGS = ([\s\S]*?);\s*\/\* END STRINGS \*\//.exec(
      swSource,
    );
    expect(json).not.toBeNull();
    // A plain object literal (no code) from our own file: evaluate it as an expression.
    // oxlint-disable-next-line no-implied-eval
    const table = new Function(`return (${json![1]!});`)() as Record<string, unknown>;
    expect(table.en).toEqual(en.common.alerts.push);
    expect(table.es).toEqual(es.common.alerts.push);
    expect(i18n.t("common.alerts.push.title.turn", { room: "AB" })).toBe("Your turn — room AB");
  });

  it("caches only same-origin GET requests and never intercepts the worker file", () => {
    expect(swSource).toMatch(/addEventListener\(\s*["']fetch["']/);
    expect(swSource).toMatch(/request\.method !== "GET"/);
    expect(swSource).toMatch(/url\.origin !== self\.location\.origin/);
    expect(swSource).toMatch(/"\/sw\.js"/);
  });
});
