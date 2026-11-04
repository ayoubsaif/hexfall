import { describe, expect, it } from "vite-plus/test";
import {
  LANGUAGE_STORAGE_KEY,
  type LanguageStorage,
  matchLanguage,
  readStoredLanguage,
  resolveInitialLanguage,
  writeStoredLanguage,
} from "../../src/i18n/language.ts";

function memoryStorage(): LanguageStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwing: LanguageStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("resolveInitialLanguage (Language from the browser)", () => {
  const pick = (preferences: string[], stored: unknown = null) =>
    resolveInitialLanguage({ stored, preferences });

  it("exact match", () => expect(pick(["es"])).toBe("es"));
  it("regional variant", () => expect(pick(["es-MX", "en-US"])).toBe("es"));
  it("first supported preference wins", () => expect(pick(["fr-FR", "en-GB", "es-ES"])).toBe("en"));
  it("nothing supported", () => expect(pick(["de-DE", "ja"])).toBe("en"));
  it("no preferences", () => expect(pick([])).toBe("en"));
  it("case-insensitive base tag", () => expect(pick(["ES-es"])).toBe("es"));
  it("a saved choice beats the browser", () => expect(pick(["es"], "en")).toBe("en"));
  it("an invalid saved value is ignored", () => expect(pick(["es"], "xx")).toBe("es"));
});

describe("matchLanguage", () => {
  it("matches on the base tag only", () => {
    expect(matchLanguage("es-419")).toBe("es");
    expect(matchLanguage("eng")).toBeNull();
  });
});

describe("language storage", () => {
  it("round-trips the choice", () => {
    const s = memoryStorage();
    expect(writeStoredLanguage("es", s)).toBe(true);
    expect(s.data[LANGUAGE_STORAGE_KEY]).toBe("es");
    expect(readStoredLanguage(s)).toBe("es");
  });

  it("storage that throws reads as nothing saved and writes report false", () => {
    expect(readStoredLanguage(throwing)).toBeNull();
    expect(writeStoredLanguage("es", throwing)).toBe(false);
  });
});
