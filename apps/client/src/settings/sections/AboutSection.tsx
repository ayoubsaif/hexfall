// About section (specs/client-settings "About section"): version, theme credits, project note.
import { useTranslation } from "react-i18next";
import { CreditsList } from "../../hud/Credits.tsx";
import { CLIENT_VERSION } from "../../net/config.ts";
import { useTheme } from "../../theme/index.ts";

export function AboutSection() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <div className="py-3 text-sm">
      <p className="font-semibold">Hexfall</p>
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
      <CreditsList theme={theme} />
      <p className="mt-4 text-xs text-muted-foreground">{t("settings.about.note")}</p>
    </div>
  );
}
