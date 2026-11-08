// Credits list (specs/asset-theming, "Credits are visible in the client"), shown in the
// settings Credits section: the active theme's per-asset credits, or its license/source when
// it declares none.
import { useTranslation } from "react-i18next";
import type { ResolvedTheme } from "../theme/resolve.ts";

export function CreditsList({ theme }: { theme: ResolvedTheme }) {
  const { t } = useTranslation();
  const credits = theme.credits ?? [];
  return (
    <>
      {credits.length > 0 && (
        <ul data-testid="credits-list" className="my-2 pl-[18px] leading-normal">
          {credits.map((c) => (
            <li key={`${c.title}|${c.keys.join(",")}`} className="list-disc">
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {c.title}
              </a>{" "}
              {t("settings.about.by")} {c.author},{" "}
              <span className="whitespace-nowrap tabular-nums">{c.license}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="my-1 text-muted-foreground">
        {credits.length > 0 ? t("settings.about.otherAssets") : t("settings.about.themeAssets")}
        {theme.license ? (
          <>
            <span className="whitespace-nowrap tabular-nums">{theme.license}</span>
            {theme.source ? `. ${theme.source}` : ""}
          </>
        ) : (
          t("settings.about.procedural")
        )}
      </p>
    </>
  );
}
