import { describe, expect, it } from "vite-plus/test";
import { type NotifyStatusInput, notifyStatus } from "../../src/settings/notifyStatus.ts";

const base: NotifyStatusInput = {
  support: { notification: true, serviceWorker: true, push: true },
  permission: "granted",
  wanted: true,
  pushKey: "key",
  pushActive: true,
  seated: true,
  ios: false,
  standalone: false,
};

describe("notifyStatus (specs/client-settings 'Notifications section')", () => {
  it("on with push when subscribed", () => {
    expect(notifyStatus(base)).toEqual({ status: "on-push", iosHint: false });
  });

  it("on with push before joining a room when the server has a key", () => {
    expect(notifyStatus({ ...base, seated: false, pushActive: false }).status).toBe("on-push");
  });

  it("tab only when the server sends no push key", () => {
    expect(notifyStatus({ ...base, pushKey: null, pushActive: false }).status).toBe("on-tab-only");
  });

  it("tab only when the browser has no Web Push or the subscription failed", () => {
    const noPush = { ...base.support, push: false };
    expect(notifyStatus({ ...base, support: noPush }).status).toBe("on-tab-only");
    expect(notifyStatus({ ...base, pushActive: false }).status).toBe("on-tab-only");
  });

  it("off when not wanted or permission not granted yet", () => {
    expect(notifyStatus({ ...base, wanted: false }).status).toBe("off");
    expect(notifyStatus({ ...base, permission: "default" }).status).toBe("off");
  });

  it("blocked when permission is denied", () => {
    expect(notifyStatus({ ...base, permission: "denied" })).toEqual({
      status: "blocked",
      iosHint: false,
    });
  });

  it("unsupported without the Notification API, with the iOS home-screen hint", () => {
    const none = { notification: false, serviceWorker: false, push: false };
    expect(notifyStatus({ ...base, support: none, permission: "unsupported" })).toEqual({
      status: "unsupported",
      iosHint: false,
    });
    expect(notifyStatus({ ...base, support: none, permission: "unsupported", ios: true })).toEqual({
      status: "unsupported",
      iosHint: true,
    });
    expect(
      notifyStatus({
        ...base,
        support: none,
        permission: "unsupported",
        ios: true,
        standalone: true,
      }).iosHint,
    ).toBe(false);
  });
});
