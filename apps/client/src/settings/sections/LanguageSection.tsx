// Language section (specs/client-settings "Language section"; client-i18n "Manual language choice").
import { useTranslation } from "react-i18next";
import {
  LANGUAGE_NAME,
  SUPPORTED_LANGUAGES,
  currentLanguage,
  setLanguage,
} from "../../i18n/index.ts";
import { ChoiceGroup } from "../parts.tsx";

export function LanguageSection() {
  const { t } = useTranslation();
  return (
    <ChoiceGroup
      testId="settings-language"
      label={t("settings.language.label")}
      hint={t("settings.language.hint")}
      value={currentLanguage()}
      choices={SUPPORTED_LANGUAGES.map((lang) => ({
        value: lang,
        label: LANGUAGE_NAME[lang],
        lang,
      }))}
      onChange={(lang) => setLanguage(lang)}
    />
  );
}
