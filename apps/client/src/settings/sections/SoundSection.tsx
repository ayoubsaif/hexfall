// Sound section (specs/client-settings "Sound section"): sounds on/off, master volume and a test.
import { Play } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { resumeAudio } from "../../audio/engine.ts";
import { playSound } from "../../audio/sounds.ts";
import { VOLUME_STEP, setPref, usePrefsStore } from "../../store/prefs.ts";
import { SettingRow } from "../parts.tsx";

export function SoundSection() {
  const { t } = useTranslation();
  const id = useId();
  const sound = usePrefsStore((s) => s.sound);
  const volume = usePrefsStore((s) => s.volume);
  const percent = Math.round(volume * 100);
  return (
    <div>
      <SettingRow
        label={t("settings.sound.enabled")}
        hint={t("settings.sound.enabledHint")}
        htmlFor={`${id}-sound`}
        control={
          <Switch
            id={`${id}-sound`}
            data-testid="settings-sound"
            checked={sound}
            onCheckedChange={(on) => setPref("sound", on)}
          />
        }
      />
      <div className="border-b border-border py-3">
        <div className="flex items-center justify-between gap-4">
          <span id={`${id}-volume`} className="text-sm font-semibold">
            {t("settings.sound.volume")}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums" aria-hidden>
            {percent} %
          </span>
        </div>
        <Slider
          data-testid="settings-volume"
          className="mt-3"
          aria-labelledby={`${id}-volume`}
          min={0}
          max={100}
          step={VOLUME_STEP * 100}
          value={[percent]}
          disabled={!sound}
          onValueChange={([v]) => {
            if (v !== undefined) setPref("volume", v / 100);
          }}
        />
      </div>
      <div className="py-3">
        <Button
          variant="secondary"
          data-testid="settings-test-sound"
          disabled={!sound}
          onClick={() => {
            void resumeAudio().then((ok) => {
              if (ok) playSound("chime");
            });
          }}
        >
          <Play aria-hidden />
          {t("settings.sound.test")}
        </Button>
      </div>
    </div>
  );
}
