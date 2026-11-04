import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_THEME_ID,
  type ManifestFetcher,
  loadTheme,
  requestedThemeId,
} from "../../src/theme/load.ts";

const manifests: Record<string, unknown> = {
  diorama: { id: "diorama", license: "CC0-1.0", source: "original", assets: {} },
  winter: {
    id: "winter",
    license: "CC0-1.0",
    source: "original",
    assets: { "tile.forest": { model: "forest.glb" } },
  },
  broken: { id: "broken", source: "original", assets: { "tile.forest": { model: "forest.glb" } } },
};

function fakeFetcher(available: Record<string, unknown> = manifests) {
  const calls: string[] = [];
  const fetcher: ManifestFetcher = async (id) => {
    calls.push(id);
    if (!(id in available)) throw new Error("HTTP 404");
    return available[id];
  };
  return { fetcher, calls };
}

describe("theme selection", () => {
  it("defaults to diorama when unset or blank", () => {
    expect(DEFAULT_THEME_ID).toBe("diorama");
    expect(requestedThemeId(undefined)).toBe("diorama");
    expect(requestedThemeId("")).toBe("diorama");
    expect(requestedThemeId("  ")).toBe("diorama");
    expect(requestedThemeId("winter")).toBe("winter");
  });

  it("loads the default theme with no configuration and no messages", async () => {
    const { theme, messages } = await loadTheme(undefined, fakeFetcher().fetcher);
    expect(theme.id).toBe("diorama");
    expect(theme.baseUrl).toBe("/themes/diorama/");
    expect(messages).toEqual([]);
  });

  it("activates a configured theme by id", async () => {
    const { theme, messages } = await loadTheme("winter", fakeFetcher().fetcher, "/app/");
    expect(theme.id).toBe("winter");
    expect(theme.baseUrl).toBe("/app/themes/winter/");
    expect(Object.keys(theme.entries)).toEqual(["tile.forest"]);
    expect(messages).toEqual([]);
  });

  it("falls back to the default theme with a warning naming an unknown id", async () => {
    const { fetcher, calls } = fakeFetcher();
    const { theme, messages } = await loadTheme("does-not-exist", fetcher);
    expect(theme.id).toBe("diorama");
    expect(calls).toEqual(["does-not-exist", "diorama"]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.level).toBe("warn");
    expect(messages[0]?.text).toContain("does-not-exist");
  });

  it("treats a syntactically invalid id as unknown without fetching it", async () => {
    const { fetcher, calls } = fakeFetcher();
    const { theme, messages } = await loadTheme("../etc", fetcher);
    expect(theme.id).toBe("diorama");
    expect(calls).toEqual(["diorama"]);
    expect(messages[0]?.text).toContain("../etc");
  });

  it("uses procedural fallbacks with an error when the manifest is invalid", async () => {
    const { theme, messages } = await loadTheme("broken", fakeFetcher().fetcher);
    expect(theme.id).toBe("broken");
    expect(theme.entries).toEqual({});
    expect(messages).toHaveLength(1);
    expect(messages[0]?.level).toBe("error");
    expect(messages[0]?.text).toContain("broken");
    expect(messages[0]?.text).toContain("license");
  });

  it("goes fully procedural with an error when even the default theme is unavailable", async () => {
    const { theme, messages } = await loadTheme("nope", fakeFetcher({}).fetcher);
    expect(theme.id).toBe("diorama");
    expect(theme.entries).toEqual({});
    expect(messages.map((m) => m.level)).toEqual(["warn", "error"]);
  });
});
