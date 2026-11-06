// Theme manifest schema and pure parsing (specs/asset-theming, "Theme manifest",
// "Per-asset transform overrides", "Manifest validation").
import { z } from "zod";
import { type AssetKey, assetKind, isAssetKey } from "./keys.ts";
import type { Projection } from "./relief.ts";

/** Theme ids are folder names under public/themes/. */
export const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const DEG = Math.PI / 180;

const positive = z.number().positive();
const finite = z.number();
const vec3 = z.tuple([finite, finite, finite]);

/** Path-safety rules shared by model and image references (relative to the theme folder). */
function safeRelativePath(ext: RegExp, extMessage: string) {
  return z
    .string()
    .min(1)
    .refine((p) => ext.test(p), extMessage)
    .refine((p) => !p.includes("\\"), "must use forward slashes")
    .refine((p) => !p.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(p), "must be a relative path")
    .refine(
      (p) => !p.split("/").some((s) => s === ".." || s === "."),
      "must stay inside the theme folder",
    );
}

/** A model file reference: a `.glb` inside the theme folder, never absolute or a URL. */
const modelPath = safeRelativePath(/\.glb$/i, "must be a .glb file");

/** An image file reference: PNG, WebP or JPEG inside the theme folder. */
const imagePath = safeRelativePath(
  /\.(png|webp|jpe?g)$/i,
  "must be a .png, .webp, .jpg or .jpeg file",
);

/**
 * Flat keys (tiles, sea, token, harbors): one image, strict, so overrides are rejected.
 * Hex keys (tile.*, sea) may declare an isometric projection (see relief.ts).
 */
const flatEntrySchema = z
  .object({ image: imagePath, projection: z.enum(["top", "isometric"]).optional() })
  .strict();

/** Keys drawn as hexes: the only ones that may declare a projection. */
const HEX_KEYS: ReadonlySet<AssetKey> = new Set<AssetKey>([
  "tile.forest",
  "tile.pasture",
  "tile.fields",
  "tile.hills",
  "tile.mountains",
  "tile.desert",
  "sea",
]);

/** Model keys (pieces): one GLB plus optional transform overrides. */
const modelEntrySchema = z
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

const required = (field: string) => z.string().trim().min(1, `${field} is required`);

/**
 * Attribution for third-party assets (specs/asset-theming, "Asset credits"). Coverage
 * rules (keys mapped, attribution licenses credited, license allowlist) are enforced by
 * tools/check-assets.mjs; at runtime a malformed credit invalidates the manifest.
 */
const creditSchema = z
  .object({
    keys: z
      .array(z.string().refine(isAssetKey, "must be a supported asset key"))
      .min(1, "keys must name at least one asset key"),
    title: required("title"),
    author: required("author"),
    url: z.string().regex(/^https?:\/\/\S+$/i, "url must be an http(s) URL"),
    license: required("license"),
  })
  .strict();

/**
 * Seamless textures for the continuous sea surface and coast band (specs/sea-coast-rendering).
 * These are not asset keys; every field is optional and a missing one uses the procedural look.
 */
const waterSchema = z
  .object({
    caustics: imagePath.optional(),
    sand: imagePath.optional(),
  })
  .strict();

/** Validated water texture paths, relative to the theme folder. */
export type WaterEntries = z.infer<typeof waterSchema>;

const manifestSchema = z.object({
  id: z.string().regex(THEME_ID_PATTERN, "must be a lowercase theme id"),
  version: z.literal(1).optional(),
  license: required("license"),
  source: required("source"),
  credits: z.array(creditSchema).optional(),
  assets: z.record(z.string(), z.unknown()).optional(),
  water: z.unknown().optional(),
});

/** One validated credit entry. */
export interface Credit {
  keys: AssetKey[];
  title: string;
  author: string;
  url: string;
  license: string;
}

export type ModelEntryInput = z.infer<typeof modelEntrySchema>;
export type FlatEntryInput = z.infer<typeof flatEntrySchema>;

export type Vec3 = [number, number, number];

/** Overrides applied on top of the model contract. Rotation is in radians. */
export interface Transform {
  scale: Vec3;
  rotation: Vec3;
  offset: Vec3;
}

/** A validated manifest entry, tagged by its key's kind. */
export type ResolvedEntry =
  | {
      kind: "image";
      /** Image path relative to the theme folder. */
      image: string;
      /** How the image is painted: straight down (default) or isometric. */
      projection: Projection;
    }
  | {
      kind: "model";
      /** Model path relative to the theme folder. */
      model: string;
      /** Present only when the entry declares at least one override. */
      transform?: Transform;
    };

export type ResolvedEntries = Partial<Record<AssetKey, ResolvedEntry>>;

export interface ManifestResult {
  /** False when the manifest failed validation as a whole: every key falls back. */
  valid: boolean;
  license?: string;
  source?: string;
  /** Validated credits; empty when none are declared or the manifest is invalid. */
  credits: Credit[];
  /** Empty when invalid. */
  entries: ResolvedEntries;
  /** Sea and coast texture paths; empty when none are declared or the manifest is invalid. */
  water: WaterEntries;
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

function toTransform(entry: ModelEntryInput): Transform | undefined {
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

const OVERRIDE_FIELDS = ["scale", "rotation", "offset"] as const;

function fieldsOf(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/** Names kind mismatches and flat-key overrides explicitly; otherwise the schema issues. */
function flatEntryReason(raw: unknown, error: z.ZodError, key: AssetKey): string {
  const fields = fieldsOf(raw);
  if ("model" in fields && !("image" in fields)) {
    return `assets.${key}: flat key takes an "image" (PNG, WebP or JPEG), not a "model"`;
  }
  const overrides = OVERRIDE_FIELDS.filter((f) => f in fields);
  if (overrides.length > 0) {
    return `assets.${key}: flat keys do not accept transform overrides (${overrides.join(", ")})`;
  }
  return formatIssues(error, ["assets", key]);
}

function modelEntryReason(raw: unknown, error: z.ZodError, key: AssetKey): string {
  const fields = fieldsOf(raw);
  if ("image" in fields && !("model" in fields)) {
    return `assets.${key}: model key takes a "model" (GLB), not an "image"`;
  }
  return formatIssues(error, ["assets", key]);
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
    credits: [],
    entries: {},
    water: {},
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

  let water: WaterEntries = {};
  if (manifest.water !== undefined) {
    const parsedWater = waterSchema.safeParse(manifest.water);
    if (!parsedWater.success) return invalid(formatIssues(parsedWater.error, ["water"]));
    water = parsedWater.data;
  }

  const entries: ResolvedEntries = {};
  for (const [key, raw] of Object.entries(manifest.assets ?? {})) {
    if (!isAssetKey(key)) {
      warnings.push(`Theme "${themeId}": ignoring unknown asset key "${key}".`);
      continue;
    }
    if (assetKind(key) === "flat") {
      const entry = flatEntrySchema.safeParse(raw);
      if (!entry.success) return invalid(flatEntryReason(raw, entry.error, key));
      if (entry.data.projection !== undefined && !HEX_KEYS.has(key)) {
        return invalid(`assets.${key}: only tile and sea images accept a "projection"`);
      }
      entries[key] = {
        kind: "image",
        image: entry.data.image,
        projection: entry.data.projection ?? "top",
      };
    } else {
      const entry = modelEntrySchema.safeParse(raw);
      if (!entry.success) return invalid(modelEntryReason(raw, entry.error, key));
      const transform = toTransform(entry.data);
      entries[key] = transform
        ? { kind: "model", model: entry.data.model, transform }
        : { kind: "model", model: entry.data.model };
    }
  }

  return {
    valid: true,
    license: manifest.license,
    source: manifest.source,
    credits: (manifest.credits ?? []).map((c) => ({ ...c, keys: c.keys as AssetKey[] })),
    entries,
    water,
    warnings,
    errors: [],
  };
}
