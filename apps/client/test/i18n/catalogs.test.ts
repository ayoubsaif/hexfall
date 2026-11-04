// Catalog parity and English fallback (spec "Complete catalogs with English fallback").
import { afterEach, describe, expect, it } from "vite-plus/test";
import { i18n } from "../../src/i18n/index.ts";
import { CATALOGS, en } from "../../src/i18n/locales/index.ts";
import { SUPPORTED_LANGUAGES } from "../../src/i18n/language.ts";

type Tree = { readonly [k: string]: string | Tree };

/** Every leaf key path, e.g. "common.resource.brick". */
export function leafKeys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [path] : leafKeys(v, path);
  });
}

/** Keys of `reference` missing from `other`, and keys of `other` not in `reference`. */
export function keyDiff(reference: Tree, other: Tree): { missing: string[]; extra: string[] } {
  const a = new Set(leafKeys(reference));
  const b = new Set(leafKeys(other));
  return {
    missing: [...a].filter((k) => !b.has(k)).sort(),
    extra: [...b].filter((k) => !a.has(k)).sort(),
  };
}

describe("catalog parity", () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    it(`${lang} has exactly the English keys`, () => {
      expect(keyDiff(en as Tree, CATALOGS[lang] as Tree)).toEqual({ missing: [], extra: [] });
    });

    it(`${lang} has no empty strings`, () => {
      const empty = leafKeys(CATALOGS[lang] as Tree).filter(
        (k) => i18n.getResource(lang, "translation", k) === "",
      );
      expect(empty).toEqual([]);
    });
  }

  it("the diff names missing and extra key paths", () => {
    const ref = { a: { b: "x", c: "y" } };
    const other = { a: { b: "x", d: "z" } };
    expect(keyDiff(ref, other)).toEqual({ missing: ["a.c"], extra: ["a.d"] });
  });
});

describe("runtime fallback", () => {
  const key = "common.resource.brick";
  const saved = i18n.getResource("es", "translation", key) as string;

  afterEach(async () => {
    i18n.addResource("es", "translation", key, saved);
    await i18n.changeLanguage("en");
  });

  it("a missing Spanish text shows the English text, never the raw key", async () => {
    const data = i18n.store.data["es"]?.["translation"] as {
      common: { resource: Record<string, string> };
    };
    delete data.common.resource["brick"];
    await i18n.changeLanguage("es");
    expect(i18n.t(key)).toBe("Brick");
    expect(i18n.t("common.resource.ore")).toBe("Mineral");
  });
});
