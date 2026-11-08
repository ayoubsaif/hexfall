// Sound section (specs/client-settings "Sound section"): sounds on/off, master volume and a test,
// then background music on/off and its own volume.
import { Play } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { resumeAudio } from "../../audio/engine.ts";
import { currentTrack } from "../../audio/music.ts";
import { playSound } from "../../audio/sounds.ts";
import { VOLUME_STEP, setPref, usePrefsStore } from "../../store/prefs.ts";
import { SettingRow } from "../parts.tsx";

export function SoundSection() {
  const { t } = useTranslation();
  const id = useId();
  const sound = usePrefsStore((s) => s.sound);
  const volume = usePrefsStore((s) => s.volume);
  const percent = Math.round(volume * 100);
  const music = usePrefsStore((s) => s.music);
  const musicPercent = Math.round(usePrefsStore((s) => s.musicVolume) * 100);
  const track = currentTrack();
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
      <div className="border-b border-border py-3">
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
      <SettingRow
        label={t("settings.sound.music")}
        hint={t("settings.sound.musicHint")}
        htmlFor={`${id}-music`}
        control={
          <Switch
            id={`${id}-music`}
            data-testid="settings-music"
            checked={music}
            onCheckedChange={(on) => setPref("music", on)}
          />
        }
      />
      <div className="py-3">
        <div className="flex items-center justify-between gap-4">
          <span id={`${id}-music-volume`} className="text-sm font-semibold">
            {t("settings.sound.musicVolume")}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums" aria-hidden>
            {musicPercent} %
          </span>
        </div>
        <Slider
          data-testid="settings-music-volume"
          className="mt-3"
          aria-labelledby={`${id}-music-volume`}
          min={0}
          max={100}
          step={VOLUME_STEP * 100}
          value={[musicPercent]}
          disabled={!music}
          onValueChange={([v]) => {
            if (v !== undefined) setPref("musicVolume", v / 100);
          }}
        />
        {track && (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="settings-now-playing">
            {t("settings.sound.nowPlaying", { title: track.title, artist: track.artist })}
          </p>
        )}
      </div>
    </div>
  );
}
