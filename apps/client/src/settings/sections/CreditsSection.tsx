// Credits section: who made the game, the background music (with its source and license links)
// and the active theme's asset credits.
import { useTranslation } from "react-i18next";
import { PLAYLIST } from "../../audio/music.ts";
import { CreditsList } from "../../hud/Credits.tsx";
import { useTheme } from "../../theme/index.ts";

const LINK = "text-primary underline underline-offset-2";

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children}
    </a>
  );
}

export function CreditsSection() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <div className="py-3 text-sm">
      <p data-testid="settings-author" className="my-1">
        {t("settings.credits.createdBy")}{" "}
        <ExternalLink href="https://github.com/ayoubsaif">@ayoubsaif</ExternalLink>
      </p>
      <h3 className="mt-4 font-semibold">{t("settings.credits.music")}</h3>
      <ul data-testid="settings-music-credits" className="my-2 pl-[18px] leading-normal">
        {PLAYLIST.map((track) => (
          <li key={track.src} className="list-disc">
            <ExternalLink href={track.url}>{track.title}</ExternalLink> {t("settings.about.by")}{" "}
            <ExternalLink href={track.artistUrl}>{track.artist}</ExternalLink>,{" "}
            <ExternalLink href={track.licenseUrl}>{track.license}</ExternalLink>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 font-semibold">{t("settings.credits.art")}</h3>
      <CreditsList theme={theme} />
    </div>
  );
}
