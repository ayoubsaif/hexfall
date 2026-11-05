// Accessibility section (specs/client-settings "Motion preference").
import { useTranslation } from "react-i18next";
import { MOTION_PREFS, setPref, usePrefsStore } from "../../store/prefs.ts";
import { ChoiceGroup } from "../parts.tsx";

export function AccessibilitySection() {
  const { t } = useTranslation();
  const motion = usePrefsStore((s) => s.motion);
  return (
    <ChoiceGroup
      testId="settings-motion"
      label={t("settings.accessibility.motion")}
      hint={t("settings.accessibility.motionHint")}
      value={motion}
      choices={MOTION_PREFS.map((m) => ({ value: m, label: t(`settings.accessibility.${m}`) }))}
      onChange={(m) => setPref("motion", m)}
    />
  );
}
