// Notifications section (specs/client-settings "Notifications section"). Permission is only
// requested from this switch (specs/turn-notifications "Notification opt-in").
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch.tsx";
import { useNotifyStore } from "../../notify/store.ts";
import { notifySupport } from "../../notify/support.ts";
import { disableNotifications, enableNotifications } from "../../notify/sync.ts";
import { useConnectionStore } from "../../store/connection.ts";
import { usePrefsStore } from "../../store/prefs.ts";
import { useRoomStore } from "../../store/room.ts";
import { type NotifyStatus, isIos, isStandalone, notifyStatus } from "../notifyStatus.ts";
import { SettingRow } from "../parts.tsx";

const STATUS_KEY = {
  "on-push": "settings.notifications.status.onPush",
  "on-tab-only": "settings.notifications.status.onTabOnly",
  off: "settings.notifications.status.off",
  blocked: "settings.notifications.status.blocked",
  unsupported: "settings.notifications.status.unsupported",
} as const satisfies Record<NotifyStatus, string>;

export function NotificationsSection() {
  const { t } = useTranslation();
  const id = useId();
  const wanted = usePrefsStore((s) => s.notify);
  const permission = useNotifyStore((s) => s.permission);
  const pushActive = useNotifyStore((s) => s.pushActive);
  const pushKey = useConnectionStore((s) => s.pushKey);
  const seated = useRoomStore((s) => s.seat !== null);
  const { status, iosHint } = notifyStatus({
    support: notifySupport(),
    permission,
    wanted,
    pushKey,
    pushActive,
    seated,
    ios: isIos(),
    standalone: isStandalone(),
  });
  const on = status === "on-push" || status === "on-tab-only";
  return (
    <div>
      {status !== "unsupported" && (
        <SettingRow
          label={t("settings.notifications.enabled")}
          hint={t("settings.notifications.enabledHint")}
          htmlFor={`${id}-notify`}
          control={
            <Switch
              id={`${id}-notify`}
              data-testid="settings-notify"
              checked={on}
              disabled={status === "blocked"}
              aria-describedby={`${id}-status`}
              onCheckedChange={(next) =>
                void (next ? enableNotifications() : disableNotifications())
              }
            />
          }
        />
      )}
      <p
        id={`${id}-status`}
        data-testid="settings-notify-status"
        data-status={status}
        role="status"
        className="py-3 text-sm text-muted-foreground"
      >
        {t(STATUS_KEY[status])}
      </p>
      {iosHint && (
        <p data-testid="settings-ios-hint" className="pb-3 text-sm text-muted-foreground">
          {t("settings.notifications.iosHint")}
        </p>
      )}
    </div>
  );
}
