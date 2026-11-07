// About section (specs/client-settings "About section"): version, theme credits, project note.
import { useTranslation } from "react-i18next";
import { SupportButton } from "../../hud/SupportButton.tsx";
import { CreditsList } from "../../hud/Credits.tsx";
import { CLIENT_VERSION } from "../../net/config.ts";
import { useTheme } from "../../theme/index.ts";
const GAME_NAME = import.meta.env.VITE_GAME_NAME || "Hexfall"
export function AboutSection() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <div className="py-3 text-sm">
      <p className="font-semibold">{GAME_NAME}</p>
      <p data-testid="settings-version" className="text-muted-foreground tabular-nums">
        {t("settings.about.version", { version: CLIENT_VERSION })}
      </p>
      <h3 className="mt-4 font-semibold">{t("settings.about.credits")}</h3>
      <p data-testid="settings-author" className="my-1">
        {t("settings.about.createdBy")}{" "}
        <a
          href="https://github.com/ayoubsaif"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          @ayoubsaif
        </a>
      </p>
      <div className="my-2 flex">
        <SupportButton className="flex cursor-pointer items-center gap-2 rounded-full border border-[#c9a04e]/40 bg-[#2a160b]/75 px-4 py-1.5 text-sm font-semibold text-[#f6ecd0] outline-none hover:bg-[#2a160b]/90 focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <CreditsList theme={theme} />
      <p className="mt-4 text-xs text-muted-foreground">{t("settings.about.note")}</p>
    </div>
  );
}
