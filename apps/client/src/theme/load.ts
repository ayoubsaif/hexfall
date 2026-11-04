// Theme selection and manifest loading. Fetching is injected so this stays testable.
import { THEME_ID_PATTERN, parseManifest } from "./manifest.ts";
import type { ResolvedTheme } from "./resolve.ts";

export const DEFAULT_THEME_ID = "diorama";

export interface ThemeMessage {
  level: "warn" | "error";
  text: string;
}

export interface ThemeLoadResult {
  theme: ResolvedTheme;
  messages: ThemeMessage[];
}

/** Fetches a theme's parsed theme.json; must throw when the theme is unavailable. */
export type ManifestFetcher = (themeId: string) => Promise<unknown>;

export function themeBaseUrl(appBase: string, themeId: string): string {
  const base = appBase.endsWith("/") ? appBase : `${appBase}/`;
  return `${base}themes/${themeId}/`;
}

/** Normalizes the configured id: unset or blank means the default theme. */
export function requestedThemeId(configured: unknown): string {
  return typeof configured === "string" && configured.trim() !== ""
    ? configured.trim()
    : DEFAULT_THEME_ID;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads the configured theme. An unknown or unavailable id falls back to the default
 * theme with a warning naming the id. An invalid manifest is not used: every key
 * renders procedurally and an error-level message is reported.
 */
export async function loadTheme(
  configured: unknown,
  fetchManifest: ManifestFetcher,
  appBase = "/",
): Promise<ThemeLoadResult> {
  const messages: ThemeMessage[] = [];
  let id = requestedThemeId(configured);
  let json: unknown;
  let available = false;

  if (THEME_ID_PATTERN.test(id)) {
    try {
      json = await fetchManifest(id);
      available = true;
    } catch (error) {
      if (id === DEFAULT_THEME_ID) {
        messages.push({
          level: "error",
          text: `Default theme "${id}" is unavailable (${reasonOf(error)}); all assets use procedural fallbacks.`,
        });
      } else {
        messages.push({
          level: "warn",
          text: `Theme "${id}" is unknown or unavailable (${reasonOf(error)}); falling back to default theme "${DEFAULT_THEME_ID}".`,
        });
      }
    }
  } else {
    messages.push({
      level: "warn",
      text: `Theme "${id}" is not a valid theme id; falling back to default theme "${DEFAULT_THEME_ID}".`,
    });
  }

  if (!available && id !== DEFAULT_THEME_ID) {
    id = DEFAULT_THEME_ID;
    try {
      json = await fetchManifest(id);
      available = true;
    } catch (error) {
      messages.push({
        level: "error",
        text: `Default theme "${id}" is unavailable (${reasonOf(error)}); all assets use procedural fallbacks.`,
      });
    }
  }

  const theme: ResolvedTheme = { id, baseUrl: themeBaseUrl(appBase, id), entries: {} };
  if (!available) return { theme, messages };

  const result = parseManifest(json, id);
  for (const text of result.warnings) messages.push({ level: "warn", text });
  for (const text of result.errors) messages.push({ level: "error", text });
  theme.entries = result.entries;
  return { theme, messages };
}

/** Browser fetcher for public/themes/<id>/theme.json. */
export function httpManifestFetcher(appBase = "/"): ManifestFetcher {
  return async (themeId) => {
    const url = `${themeBaseUrl(appBase, themeId)}theme.json`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      // Dev servers may answer unknown paths with index.html.
      throw new Error(`${url} is not JSON`);
    }
  };
}
