// Accessibility section (specs/client-settings "Motion preference"; openspec
// tutorial-mode-and-rules-guide, specs/tutorial-mode "Turning tutorial off and on").
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch.tsx";
import { MOTION_PREFS, setPref, usePrefsStore } from "../../store/prefs.ts";
import { setTutorialEnabled, useTutorial } from "../../store/tutorial.ts";
import { ChoiceGroup, SettingRow } from "../parts.tsx";

export function AccessibilitySection() {
  const { t } = useTranslation();
  const id = useId();
  const motion = usePrefsStore((s) => s.motion);
  const tutorial = useTutorial((s) => s.enabled);
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
      <SettingRow
        label={t("tutorial.settings.label")}
        hint={t("tutorial.settings.hint")}
        htmlFor={`${id}-tutorial`}
        control={
          <Switch
            id={`${id}-tutorial`}
            data-testid="settings-tutorial"
            checked={tutorial}
            onCheckedChange={setTutorialEnabled}
          />
        }
      />
    </div>
  );
}
