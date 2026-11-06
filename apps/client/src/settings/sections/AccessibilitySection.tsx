// Accessibility section (specs/client-settings "Motion preference").
import { useTranslation } from "react-i18next";
import { MOTION_PREFS, WHEEL_PREFS, setPref, usePrefsStore } from "../../store/prefs.ts";
import { ChoiceGroup } from "../parts.tsx";

export function AccessibilitySection() {
  const { t } = useTranslation();
  const motion = usePrefsStore((s) => s.motion);
  const wheel = usePrefsStore((s) => s.wheel);
  return (
    <div className="flex flex-col gap-4">
    <ChoiceGroup
      testId="settings-motion"
      label={t("settings.accessibility.motion")}
      hint={t("settings.accessibility.motionHint")}
      value={motion}
      choices={MOTION_PREFS.map((m) => ({ value: m, label: t(`settings.accessibility.${m}`) }))}
      onChange={(m) => setPref("motion", m)}
    />
    <ChoiceGroup
      testId="settings-wheel"
      label={t("settings.accessibility.wheel")}
      hint={t("settings.accessibility.wheelHint")}
      value={wheel}
      choices={WHEEL_PREFS.map((w) => ({ value: w, label: t(`settings.accessibility.wheel_${w}`) }))}
      onChange={(w) => setPref("wheel", w)}
    />
    </div>
  );
}
