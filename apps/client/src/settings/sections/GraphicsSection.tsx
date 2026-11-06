import { useTranslation } from "react-i18next";
import { GRAPHICS_MODES, GRAPHICS_QUALITIES, setPref, usePrefsStore } from "../../store/prefs.ts";
import { useGraphicsQuality } from "../../scene/graphicsQuality.ts";
import { ChoiceGroup } from "../parts.tsx";

export function GraphicsSection() {
  const { t } = useTranslation();
  const mode = usePrefsStore((s) => s.graphicsMode);
  const quality = usePrefsStore((s) => s.graphicsQuality);
  const active = useGraphicsQuality();
  return (
    <div className="flex flex-col gap-4">
      <ChoiceGroup
        testId="settings-graphics-mode"
        label={t("settings.graphics.mode")}
        hint={t("settings.graphics.modeHint")}
        value={mode}
        choices={GRAPHICS_MODES.map((value) => ({ value, label: t(`settings.graphics.${value}`) }))}
        onChange={(value) => setPref("graphicsMode", value)}
      />
      <ChoiceGroup
        testId="settings-graphics-quality"
        label={t("settings.graphics.quality")}
        hint={t("settings.graphics.qualityHint")}
        value={quality}
        choices={GRAPHICS_QUALITIES.map((value) => ({
          value,
          label: t(`settings.graphics.${value}`),
        }))}
        onChange={(value) => setPref("graphicsQuality", value)}
      />
      <p role="status" className="text-xs text-muted-foreground">
        {t("settings.graphics.active", { quality: t(`settings.graphics.${active}`) })}
      </p>
    </div>
  );
}
