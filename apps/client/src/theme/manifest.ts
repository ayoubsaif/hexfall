// Theme manifest schema and pure parsing (specs/asset-theming, "Theme manifest",
// "Per-asset transform overrides", "Manifest validation").
import { z } from "zod";
import { type AssetKey, isAssetKey } from "./keys.ts";

/** Theme ids are folder names under public/themes/. */
export const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const DEG = Math.PI / 180;

const positive = z.number().positive();
const finite = z.number();
const vec3 = z.tuple([finite, finite, finite]);

/**
 * A model file reference, relative to the theme folder. Must be a `.glb`, must not
 * escape the theme folder and must not be an absolute path or URL.
 */
const modelPath = z
  .string()
  .min(1)
  .refine((p) => /\.glb$/i.test(p), "must be a .glb file")
  .refine((p) => !p.includes("\\"), "must use forward slashes")
  .refine((p) => !p.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(p), "must be a relative path")
  .refine(
    (p) => !p.split("/").some((s) => s === ".." || s === "."),
    "must stay inside the theme folder",
  );

const entrySchema = z
  .object({
    model: modelPath,
    /** Uniform scale or per-axis [x, y, z]; all factors must be > 0. */
    scale: z.union([positive, z.tuple([positive, positive, positive])]).optional(),
    /** Euler rotation in degrees, [x, y, z]. */
    rotation: vec3.optional(),
    /** Offset in model units (1 = hex circumradius), [x, y, z]. */
    offset: vec3.optional(),
  })
  .strict();

const manifestSchema = z.object({
  id: z.string().regex(THEME_ID_PATTERN, "must be a lowercase theme id"),
  version: z.literal(1).optional(),
  license: z.string().trim().min(1, "license is required"),
  source: z.string().trim().min(1, "source is required"),
  assets: z.record(z.string(), z.unknown()).optional(),
});

export type ManifestEntryInput = z.infer<typeof entrySchema>;

export type Vec3 = [number, number, number];

/** Overrides applied on top of the model contract. Rotation is in radians. */
export interface Transform {
  scale: Vec3;
  rotation: Vec3;
  offset: Vec3;
}

export interface ResolvedEntry {
  /** Model path relative to the theme folder. */
  model: string;
  /** Present only when the entry declares at least one override. */
  transform?: Transform;
}

export type ResolvedEntries = Partial<Record<AssetKey, ResolvedEntry>>;

export interface ManifestResult {
  /** False when the manifest failed validation as a whole: every key falls back. */
  valid: boolean;
  license?: string;
  source?: string;
  /** Empty when invalid. */
  entries: ResolvedEntries;
  warnings: string[];
  errors: string[];
}

function formatIssues(error: z.ZodError, prefix: (string | number)[] = []): string {
  return error.issues
    .map((issue) => {
      const path = [...prefix, ...issue.path.map(String)].join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

function toTransform(entry: ManifestEntryInput): Transform | undefined {
  if (entry.scale === undefined && entry.rotation === undefined && entry.offset === undefined) {
    return undefined;
  }
  const s = entry.scale ?? 1;
  const r = entry.rotation ?? [0, 0, 0];
  return {
    scale: typeof s === "number" ? [s, s, s] : [s[0], s[1], s[2]],
    rotation: [r[0] * DEG, r[1] * DEG, r[2] * DEG],
    offset: entry.offset ? [entry.offset[0], entry.offset[1], entry.offset[2]] : [0, 0, 0],
  };
}

/**
 * Validates a manifest and resolves its key map. Pure: never throws, never logs.
 * Unknown keys are dropped with a warning; any other validation failure makes the
 * whole manifest invalid (empty entries, one error-level message).
 */
export function parseManifest(json: unknown, themeId: string): ManifestResult {
  const warnings: string[] = [];
  const invalid = (reason: string): ManifestResult => ({
    valid: false,
    entries: {},
    warnings,
    errors: [
      `Theme "${themeId}": invalid manifest (${reason}); all assets use procedural fallbacks.`,
    ],
  });

  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) return invalid(formatIssues(parsed.error));
  const manifest = parsed.data;

  if (manifest.id !== themeId) {
    warnings.push(`Theme "${themeId}": manifest declares id "${manifest.id}".`);
  }

  const entries: ResolvedEntries = {};
  for (const [key, raw] of Object.entries(manifest.assets ?? {})) {
    if (!isAssetKey(key)) {
      warnings.push(`Theme "${themeId}": ignoring unknown asset key "${key}".`);
      continue;
    }
    const entry = entrySchema.safeParse(raw);
    if (!entry.success) return invalid(formatIssues(entry.error, ["assets", key]));
    const transform = toTransform(entry.data);
    entries[key] = transform ? { model: entry.data.model, transform } : { model: entry.data.model };
  }

  return {
    valid: true,
    license: manifest.license,
    source: manifest.source,
    entries,
    warnings,
    errors: [],
  };
}
