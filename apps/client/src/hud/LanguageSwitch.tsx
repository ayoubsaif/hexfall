// Language switch (specs/client-i18n, "Manual language choice"). Applies immediately and
// is saved on the device. Language names are shown in their own language.
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAME, SUPPORTED_LANGUAGES, currentLanguage, setLanguage } from "../i18n/index.ts";

export function LanguageSwitch() {
  const { t } = useTranslation();
  const active = currentLanguage();
  return (
    <div
      className="pointer-events-auto flex rounded-full bg-hud p-[3px] shadow-lg shadow-black/25 backdrop-blur-md"
      role="radiogroup"
      aria-label={t("common.language.label")}
      data-testid="language-switch"
      data-interactive
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          role="radio"
          lang={lang}
          aria-checked={active === lang}
          className="min-h-9 min-w-13 cursor-pointer rounded-full px-3.5 font-semibold text-muted-foreground transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring aria-checked:bg-primary aria-checked:text-primary-foreground max-sm:min-h-10 short:min-h-10"
          onClick={() => setLanguage(lang)}
        >
          {LANGUAGE_NAME[lang]}
        </button>
      ))}
    </div>
  );
}
