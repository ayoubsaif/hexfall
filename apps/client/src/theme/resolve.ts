// Pure asset resolution: key -> themed image URL, themed model URL (+ overrides), or
// procedural fallback.
import type { AssetKey } from "./keys.ts";
import type { Credit, ResolvedEntries, Transform } from "./manifest.ts";
import type { Projection } from "./relief.ts";

export interface ResolvedTheme {
  /** Active theme id (the one whose manifest was loaded, or attempted). */
  id: string;
  /** URL of the theme folder, ending with "/". */
  baseUrl: string;
  /** Validated key map; empty means every key is procedural. */
  entries: ResolvedEntries;
  /** Manifest-level license/source; absent until a valid manifest is loaded. */
  license?: string;
  source?: string;
  /** Per-asset credits (specs/asset-theming, "Asset credits"); absent means none. */
  credits?: Credit[];
}

export type AssetResolution =
  | { kind: "fallback"; key: AssetKey; reason: "unmapped" | "failed" }
  | { kind: "image"; key: AssetKey; url: string; projection: Projection }
  | { kind: "model"; key: AssetKey; url: string; transform: Transform | undefined };

/** What kind of file a themed resolution loads. */
export type ThemedFileKind = "image" | "model";

/** Builds a file URL inside the theme folder, encoding each path segment. */
export function themeFileUrl(baseUrl: string, path: string): string {
  return baseUrl + path.split("/").map(encodeURIComponent).join("/");
}

export function resolveAsset(
  theme: ResolvedTheme,
  key: AssetKey,
  failedKeys: ReadonlySet<AssetKey> = new Set(),
): AssetResolution {
  const entry = theme.entries[key];
  if (!entry) return { kind: "fallback", key, reason: "unmapped" };
  if (failedKeys.has(key)) return { kind: "fallback", key, reason: "failed" };
  if (entry.kind === "image") {
    return {
      kind: "image",
      key,
      url: themeFileUrl(theme.baseUrl, entry.image),
      projection: entry.projection,
    };
  }
  return {
    kind: "model",
    key,
    url: themeFileUrl(theme.baseUrl, entry.model),
    transform: entry.transform,
  };
}

export function loadFailureMessage(
  key: AssetKey,
  themeId: string,
  fileKind: ThemedFileKind,
  url: string,
  error: unknown,
): string {
  const reason = error instanceof Error ? error.message : String(error);
  return `Theme "${themeId}": failed to load ${fileKind} for "${key}" (${url}): ${reason}. Using procedural fallback.`;
}
