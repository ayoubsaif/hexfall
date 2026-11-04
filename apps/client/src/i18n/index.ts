// i18n setup (specs/client-i18n). Initialized synchronously in English at import,
// so tests and the first render never wait; main.tsx then applies the detected language.
import i18next, { type TFunction } from "i18next";
import { initReactI18next } from "react-i18next";
import { CATALOGS, type en } from "./locales/index.ts";
import {
  DEFAULT_LANGUAGE,
  type Language,
  type LanguageStorage,
  SUPPORTED_LANGUAGES,
  detectInitialLanguage,
  isLanguage,
  writeStoredLanguage,
} from "./language.ts";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

/** Translation function passed into pure text modules. */
export type T = TFunction;

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  resources: Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l, { translation: CATALOGS[l] }])),
  initAsync: false,
  interpolation: { escapeValue: false }, // React escapes.
  returnNull: false,
  returnEmptyString: false,
});

function syncDocumentLang(lng: string): void {
  try {
    if (typeof document !== "undefined") document.documentElement.lang = lng;
  } catch {
    // No DOM: nothing to update.
  }
}

i18n.on("languageChanged", syncDocumentLang);
syncDocumentLang(i18n.language);

/** The language currently shown. */
export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

/** The player's choice: switch now and save it on the device (storage errors are ignored). */
export function setLanguage(lang: Language, storage?: LanguageStorage | null): void {
  void i18n.changeLanguage(lang);
  if (storage === undefined) writeStoredLanguage(lang);
  else writeStoredLanguage(lang, storage);
}

/** Startup: apply the saved or browser-derived language without saving it. */
export function applyInitialLanguage(storage?: LanguageStorage | null): Language {
  const lang = storage === undefined ? detectInitialLanguage() : detectInitialLanguage(storage);
  void i18n.changeLanguage(lang);
  return lang;
}

/** A translation function fixed to one language (tests, previews). */
export function fixedT(lang: Language): T {
  return i18n.getFixedT(lang);
}

export { LANGUAGE_NAME, SUPPORTED_LANGUAGES, type Language } from "./language.ts";
