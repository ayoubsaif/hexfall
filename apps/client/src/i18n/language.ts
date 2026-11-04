// Display language choice (specs/client-i18n): a valid saved choice wins, then the
// first browser preference whose base tag is supported, then English.

export type Language = "en" | "es";

export const SUPPORTED_LANGUAGES: readonly Language[] = ["en", "es"];

export const DEFAULT_LANGUAGE: Language = "en";

/** Each language's name in its own language (never translated). */
export const LANGUAGE_NAME: Readonly<Record<Language, string>> = {
  en: "English",
  es: "Español",
};

/** localStorage key holding the viewer's chosen language. */
export const LANGUAGE_STORAGE_KEY = "hexfall.language";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Supported language for a BCP 47 tag, matched on its base part ("es-MX" -> "es"). */
export function matchLanguage(tag: string): Language | null {
  const base = tag.split("-")[0]?.trim().toLowerCase() ?? "";
  return isLanguage(base) ? base : null;
}

export function resolveInitialLanguage(env: {
  stored: unknown;
  preferences: readonly string[];
}): Language {
  if (isLanguage(env.stored)) return env.stored;
  for (const tag of env.preferences) {
    const lang = matchLanguage(tag);
    if (lang) return lang;
  }
  return DEFAULT_LANGUAGE;
}

/** Minimal storage surface (localStorage in the browser, a fake in tests). */
export type LanguageStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): LanguageStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Accessing localStorage itself can throw (blocked site data).
  }
}

/** Reads the saved language; any storage error reads as "nothing saved". */
export function readStoredLanguage(storage: LanguageStorage | null = defaultStorage()): unknown {
  try {
    return storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Saves the language; returns false (and keeps going) when storage is unavailable. */
export function writeStoredLanguage(
  lang: Language,
  storage: LanguageStorage | null = defaultStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LANGUAGE_STORAGE_KEY, lang);
    return true;
  } catch {
    return false;
  }
}

/** The browser's ordered language preferences (empty when unavailable). */
export function browserPreferences(): string[] {
  try {
    const nav = globalThis.navigator;
    if (!nav) return [];
    if (Array.isArray(nav.languages) && nav.languages.length > 0) return [...nav.languages];
    return nav.language ? [nav.language] : [];
  } catch {
    return [];
  }
}

/** Reads the environment (storage, browser) and resolves the initial language. */
export function detectInitialLanguage(
  storage: LanguageStorage | null = defaultStorage(),
): Language {
  return resolveInitialLanguage({
    stored: readStoredLanguage(storage),
    preferences: browserPreferences(),
  });
}
