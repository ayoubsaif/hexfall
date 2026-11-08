// About section (specs/client-settings "About section"): version, support link, project note.
// Credits have their own section (CreditsSection).
import { useTranslation } from "react-i18next";
import { SupportButton } from "../../hud/SupportButton.tsx";
import { CLIENT_VERSION } from "../../net/config.ts";
const GAME_NAME = import.meta.env.VITE_GAME_NAME || "Hexfall";
export function AboutSection() {
  const { t } = useTranslation();
  return (
    <div className="py-3 text-sm">
      <p className="font-semibold">{GAME_NAME}</p>
      <p data-testid="settings-version" className="text-muted-foreground tabular-nums">
        {t("settings.about.version", { version: CLIENT_VERSION })}
      </p>
      <div className="my-3 flex">
        <SupportButton className="flex cursor-pointer items-center gap-2 rounded-full border border-[#c9a04e]/40 bg-[#2a160b]/75 px-4 py-1.5 text-sm font-semibold text-[#f6ecd0] outline-none hover:bg-[#2a160b]/90 focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("settings.about.note")}</p>
    </div>
  );
}
