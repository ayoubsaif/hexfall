// Pure asset resolution: key -> themed model URL (+ overrides) or procedural fallback.
import type { AssetKey } from "./keys.ts";
import type { ResolvedEntries, Transform } from "./manifest.ts";

export interface ResolvedTheme {
  /** Active theme id (the one whose manifest was loaded, or attempted). */
  id: string;
  /** URL of the theme folder, ending with "/". */
  baseUrl: string;
  /** Validated key map; empty means every key is procedural. */
  entries: ResolvedEntries;
}

export type AssetResolution =
  | { kind: "fallback"; key: AssetKey; reason: "unmapped" | "failed" }
  | { kind: "model"; key: AssetKey; url: string; transform: Transform | undefined };

/** Builds a model URL inside the theme folder, encoding each path segment. */
export function modelUrl(baseUrl: string, model: string): string {
  return baseUrl + model.split("/").map(encodeURIComponent).join("/");
}

export function resolveAsset(
  theme: ResolvedTheme,
  key: AssetKey,
  failedKeys: ReadonlySet<AssetKey> = new Set(),
): AssetResolution {
  const entry = theme.entries[key];
  if (!entry) return { kind: "fallback", key, reason: "unmapped" };
  if (failedKeys.has(key)) return { kind: "fallback", key, reason: "failed" };
  return {
    kind: "model",
    key,
    url: modelUrl(theme.baseUrl, entry.model),
    transform: entry.transform,
  };
}

export function loadFailureMessage(
  key: AssetKey,
  themeId: string,
  url: string,
  error: unknown,
): string {
  const reason = error instanceof Error ? error.message : String(error);
  return `Theme "${themeId}": failed to load model for "${key}" (${url}): ${reason}. Using procedural fallback.`;
}
