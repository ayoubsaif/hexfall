import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch.tsx";
import { GRAPHICS_MODES, GRAPHICS_QUALITIES, setPref, usePrefsStore } from "../../store/prefs.ts";
import { useGraphicsQuality } from "../../scene/graphicsQuality.ts";
import { ChoiceGroup, SettingRow } from "../parts.tsx";

export function GraphicsSection() {
  const { t } = useTranslation();
  const mode = usePrefsStore((s) => s.graphicsMode);
  const quality = usePrefsStore((s) => s.graphicsQuality);
  const active = useGraphicsQuality();
  const filters = usePrefsStore((s) => s.screenFilters);
  const id = useId();
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
      <SettingRow
        label={t("settings.graphics.filters")}
        hint={t("settings.graphics.filtersHint")}
        htmlFor={`${id}-filters`}
        control={
          <Switch
            id={`${id}-filters`}
            data-testid="settings-screen-filters"
            checked={filters}
            onCheckedChange={(on) => setPref("screenFilters", on)}
          />
        }
      />
    </div>
  );
}
