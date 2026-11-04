import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  applyInitialLanguage,
  currentLanguage,
  fixedT,
  i18n,
  setLanguage,
} from "../../src/i18n/index.ts";
import type { LanguageStorage } from "../../src/i18n/language.ts";

const throwing: LanguageStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("i18n setup", () => {
  it("starts in English and translates shared names", () => {
    expect(currentLanguage()).toBe("en");
    expect(i18n.t("common.resource.brick")).toBe("Brick");
    expect(fixedT("es")("common.resource.brick")).toBe("Ladrillo");
  });

  it("keeps <html lang> in sync with the language (Document language)", () => {
    expect(document.documentElement.lang).toBe("en");
    setLanguage("es", null);
    expect(document.documentElement.lang).toBe("es");
    setLanguage("en", null);
    expect(document.documentElement.lang).toBe("en");
  });

  it("switching still works when storage throws (Storage blocked)", () => {
    setLanguage("es", throwing);
    expect(currentLanguage()).toBe("es");
    expect(applyInitialLanguage(throwing)).toMatch(/^(en|es)$/);
  });

  it("a saved choice is applied at startup", () => {
    const saved: LanguageStorage = { getItem: () => "es", setItem: () => {} };
    expect(applyInitialLanguage(saved)).toBe("es");
    expect(currentLanguage()).toBe("es");
  });
});
