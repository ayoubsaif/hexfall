// Reference-art guard + theme validation + asset budget check (tasks 2.6, 6.7;
// design.md decision 10; specs/asset-theming "Asset budget check", "Licensing guard").
//
// Fails (exit 1) when:
//   - a text file under apps/ or packages/ references the repo-root reference folder
//     assets/ (a path that resolves to it, an absolute path into it, or one of its file names)
//   - a theme folder in apps/client/public/themes/ holds a model or image file its manifest
//     does not reference
//   - a manifest is unreadable, lacks a license/source, or references a missing file,
//     a path outside its theme folder, or a file under assets/
//   - an entry's file field does not match its key's kind (flat keys take "image",
//     model keys take "model"; specs/asset-theming "Asset kinds")
//   - an image entry's "projection" is not "top"/"isometric", or is set on a non-hex key
//   - an isometric image is not 16:17 (1024 x 1088 reference; specs/asset-theming
//     "Isometric tile images")
//   - a manifest or credit declares a license outside the allowlist (NC/ND are rejected),
//     a credit is incomplete or names an unmapped key, or an attribution-licensed mapped
//     key has no credit (specs/asset-theming "Asset credits", "Licensing guard")
// Warns (exit 0) on a referenced GLB that is not Draco/meshopt compressed or exceeds 300 KB,
// on a referenced image over 400 KB, and on a top-down image that is not square.
// No dependencies: plain Node ESM. `--themes <dir>` checks another themes folder (tests).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ICON_OUTPUTS, ICO_SIZES, OG_MAX_BYTES } from "./icon-list.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REF_DIR = join(ROOT, "assets");
const themesArg = process.argv.indexOf("--themes");
const THEMES_DIR =
  themesArg !== -1 && process.argv[themesArg + 1]
    ? resolve(process.argv[themesArg + 1])
    : join(ROOT, "apps", "client", "public", "themes");
// Allowed asset licenses (SPDX). Everything but CC0 requires attribution via a credit.
// LicenseRef-BlendKit-RF: BlendKit's Royalty Free license, for models embedded in the game only.
const ALLOWED_LICENSES = new Set([
  "CC0-1.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC-BY-SA-3.0",
  "CC-BY-SA-4.0",
  "MIT",
  "LicenseRef-BlendKit-RF",
]);
const NO_ATTRIBUTION = new Set(["CC0-1.0"]);
const SCAN_DIRS = ["apps", "packages"].map((d) => join(ROOT, d));
const SKIP_DIRS = new Set(["node_modules", "dist", ".vite", "coverage", ".turbo"]);
const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".html",
  ".css",
  ".scss",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
  ".svg",
  ".gltf",
  ".env",
]);
const MODEL_EXT = new Set([
  ".glb",
  ".gltf",
  ".bin",
  ".obj",
  ".mtl",
  ".fbx",
  ".dae",
  ".stl",
  ".ply",
  ".3ds",
  ".blend",
  ".usdz",
]);
const IMAGE_EXT = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const BUDGET_BYTES = 300 * 1024;
const IMAGE_BUDGET_BYTES = 400 * 1024;
const COMPRESSION_EXT = ["KHR_draco_mesh_compression", "EXT_meshopt_compression"];

const failures = [];
const warnings = [];
const rel = (p) => relative(ROOT, p).split(sep).join("/");
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function isInside(child, parent) {
  const r = relative(parent, child);
  return r === "" || (!r.startsWith("..") && !isAbsolute(r));
}

// ---------------------------------------------------------------------------
// 1. Reference-art guard over apps/ and packages/.

// File names inside assets/ (names only; the files themselves are never opened). The
// extension-less stem is matched too when it is distinctive: 8+ characters with a digit,
// "-" or "_" (e.g. "matt-mocarski-catan-05"). Plain words such as "settlement" would
// match ordinary game code, so those are matched only with their extension.
const refFiles = existsSync(REF_DIR)
  ? [...walk(REF_DIR)].map((f) => {
      const name = basename(f).toLowerCase();
      const stem = name.slice(0, name.length - extname(name).length);
      return { name, stem: stem.length >= 8 && /[\d_-]/.test(stem) ? stem : name };
    })
  : [];
const refNames = refFiles.map((f) => f.name);

// Absolute spellings of the root assets/ folder: G:\games\catan\assets, G:/games/..., /g/games/...
const rootFwd = ROOT.split(sep).join("/").toLowerCase();
const absRefPrefixes = [rootFwd, rootFwd.replace(/^([a-z]):/, (_m, d) => `/${d}`)].map(
  (p) => `${p}/assets`,
);

// Relative paths like ../../assets or ./../assets/x.jpg; resolved against the file's folder.
const RELATIVE_REF = /((?:\.\.?[\\/])+)assets(?=$|[\\/"'`\s)\],;:*?])/g;

function scanForReferenceArt(file) {
  if (!TEXT_EXT.has(extname(file).toLowerCase()) && !basename(file).startsWith(".env")) return;
  const text = readFileSync(file, "utf8");
  const lower = text.toLowerCase();
  const hits = new Set();

  const fwd = lower.replaceAll("\\\\", "/").replaceAll("\\", "/");
  for (const prefix of absRefPrefixes) {
    let i = fwd.indexOf(prefix);
    while (i !== -1) {
      const next = fwd[i + prefix.length];
      if (next === undefined || /[/"'`\s)\],;:*?]/.test(next))
        hits.add(`absolute path into assets/`);
      i = fwd.indexOf(prefix, i + 1);
    }
  }
  for (const m of text.matchAll(RELATIVE_REF)) {
    if (resolve(dirname(file), `${m[1]}assets`) === REF_DIR)
      hits.add(`"${m[0]}" resolves to assets/`);
  }
  for (const { name, stem } of refFiles) {
    if (lower.includes(stem)) hits.add(`names reference file "${name}"`);
  }
  for (const h of hits) failures.push(`${rel(file)}: references the root assets/ folder (${h}).`);
}

for (const dir of SCAN_DIRS) for (const file of walk(dir)) scanForReferenceArt(file);

// ---------------------------------------------------------------------------
// 2. Theme manifests, orphan model/image files and asset budget.

let knownKeys;
let keyKinds;
try {
  // Node 24 strips types natively; keys.ts uses erasable syntax only.
  ({ ASSET_KEYS: knownKeys, ASSET_KIND: keyKinds } =
    await import("../apps/client/src/theme/keys.ts"));
} catch (error) {
  failures.push(
    `cannot read asset keys/kinds from apps/client/src/theme/keys.ts (${error.message}).`,
  );
  knownKeys = undefined;
  keyKinds = undefined;
}

function inspectGlb(file) {
  const buf = readFileSync(file);
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) return { error: "not a GLB file" };
  if (buf.readUInt32LE(4) !== 2) return { error: `unsupported GLB version ${buf.readUInt32LE(4)}` };
  const chunkLength = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a || 20 + chunkLength > buf.length) {
    return { error: "missing or truncated JSON chunk" };
  }
  try {
    const json = JSON.parse(buf.subarray(20, 20 + chunkLength).toString("utf8"));
    const used = Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [];
    return { compressed: COMPRESSION_EXT.some((e) => used.includes(e)) };
  } catch {
    return { error: "invalid JSON chunk" };
  }
}

const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";
// Pixel size of a PNG, WebP or JPEG file from its header; undefined if unreadable.
function imageSize(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (
    buf.length >= 30 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (chunk === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
    return undefined;
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return undefined;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      const sof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (sof) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return undefined;
}

const HEX_KEYS = new Set([
  "tile.forest",
  "tile.pasture",
  "tile.fields",
  "tile.hills",
  "tile.mountains",
  "tile.desert",
  "sea",
]);
const ISO_RATIO = 1088 / 1024;

const WATER_SLOTS = ["caustics", "sand"];
const WATER_BUDGET_BYTES = 300 * 1024;

/** Sea and coast textures (specs/sea-coast-rendering): exist, square, and within the budget. */
function checkWater(theme, themeDir, water, referenced) {
  if (water === undefined) return;
  if (water === null || typeof water !== "object" || Array.isArray(water)) {
    failures.push(`theme "${theme}": "water" must be an object.`);
    return;
  }
  let total = 0;
  for (const [slot, file] of Object.entries(water)) {
    if (!WATER_SLOTS.includes(slot)) {
      failures.push(
        `theme "${theme}": unknown water texture "${slot}" (expected ${WATER_SLOTS.join(", ")}).`,
      );
      continue;
    }
    if (!nonEmpty(file)) {
      failures.push(`theme "${theme}", water "${slot}": entry has no image file.`);
      continue;
    }
    const before = failures.length;
    checkFile(theme, themeDir, `water.${slot}`, "image", file, referenced);
    if (failures.length > before) continue;
    const target = resolve(themeDir, file.replace(/^\/+/, ""));
    total += statSync(target).size;
    const dim = imageSize(readFileSync(target));
    if (dim && dim.width !== dim.height) {
      failures.push(
        `theme "${theme}", water "${slot}": ${file} is ${dim.width}x${dim.height}; it must be square to tile.`,
      );
    }
  }
  if (total > WATER_BUDGET_BYTES) {
    failures.push(
      `theme "${theme}": water textures total ${kb(total)}; the budget is ${kb(WATER_BUDGET_BYTES)}.`,
    );
  }
}

let themeCount = 0;
let modelCount = 0;
let imageCount = 0;

function checkFile(theme, themeDir, key, fileKind, file, referenced, projection = "top") {
  const where = `theme "${theme}", key "${key}"`;
  const target =
    isAbsolute(file) || /^[a-z]:/i.test(file)
      ? resolve(file)
      : resolve(themeDir, file.replace(/^\/+/, ""));
  const lowerName = basename(file).toLowerCase();
  // Into assets/: resolves there, names one of its files, or is an absolute or
  // parent-relative path through an "assets" segment (e.g. "/assets/x.glb").
  const escapesViaAssets = /(^|[\\/])assets[\\/]/i.test(file) && /\.\.|^[\\/]|^[a-z]:/i.test(file);
  if (isInside(target, REF_DIR) || escapesViaAssets || refNames.includes(lowerName)) {
    failures.push(`${where}: "${file}" points into the reference folder assets/.`);
    return;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file) || !isInside(target, themeDir)) {
    failures.push(`${where}: "${file}" is outside the theme folder.`);
    return;
  }
  referenced.add(target);
  if (!existsSync(target) || !statSync(target).isFile()) {
    failures.push(`${where}: file "${file}" does not exist (${rel(target)}).`);
    return;
  }
  const size = statSync(target).size;
  const ext = extname(target).toLowerCase();

  if (fileKind === "image") {
    imageCount++;
    if (!IMAGE_EXT.has(ext)) {
      failures.push(`${where}: image "${file}" must be a .png, .webp, .jpg or .jpeg file.`);
    }
    if (size > IMAGE_BUDGET_BYTES) {
      warnings.push(`${where}: image ${file} is ${kb(size)} (budget ~${kb(IMAGE_BUDGET_BYTES)}).`);
    }
    const dim = imageSize(readFileSync(target));
    if (!dim) {
      warnings.push(`${where}: could not read the pixel size of ${file}.`);
    } else if (projection === "isometric") {
      if (Math.abs(dim.height / dim.width - ISO_RATIO) > 0.01) {
        failures.push(
          `${where}: isometric image ${file} is ${dim.width}x${dim.height}; it must be 16:17 (e.g. 1024x1088).`,
        );
      }
    } else if (HEX_KEYS.has(key) && dim.width !== dim.height) {
      warnings.push(`${where}: top-down image ${file} is ${dim.width}x${dim.height}, not square.`);
    }
    return;
  }

  modelCount++;
  if (size > BUDGET_BYTES) {
    warnings.push(`${where}: ${file} is ${kb(size)} (budget ~${kb(BUDGET_BYTES)}).`);
  }
  if (ext !== ".glb") {
    warnings.push(`${where}: ${file} (${kb(size)}) is not a GLB.`);
    return;
  }
  const glb = inspectGlb(target);
  if (glb.error) {
    warnings.push(`${where}: ${file} (${kb(size)}) ${glb.error}; it will fall back at runtime.`);
  } else if (!glb.compressed) {
    warnings.push(`${where}: ${file} (${kb(size)}) is not Draco/meshopt compressed.`);
  }
}

// SPDX id → failure reason, or undefined when allowed.
function licenseProblem(license) {
  if (!nonEmpty(license)) return "no license";
  const id = license.trim();
  if (/-(NC|ND)(-|$)/i.test(id)) return `license "${id}" is non-commercial or no-derivatives`;
  if (!ALLOWED_LICENSES.has(id)) {
    return `license "${id}" is not allowed (allowed: ${[...ALLOWED_LICENSES].join(", ")})`;
  }
  return undefined;
}

// Manifest-level license, credits and attribution coverage.
function checkLicenses(theme, manifest) {
  const assets =
    manifest.assets && typeof manifest.assets === "object" && !Array.isArray(manifest.assets)
      ? manifest.assets
      : {};
  const mapped = new Set(Object.keys(assets));
  if (nonEmpty(manifest.license)) {
    const problem = licenseProblem(manifest.license);
    if (problem) failures.push(`theme "${theme}": manifest ${problem}.`);
  }
  const credits = manifest.credits ?? [];
  if (!Array.isArray(credits)) {
    failures.push(`theme "${theme}": "credits" must be an array.`);
    return;
  }
  const creditedBy = new Map();
  credits.forEach((credit, i) => {
    const c = credit && typeof credit === "object" && !Array.isArray(credit) ? credit : {};
    const keys = Array.isArray(c.keys) ? c.keys : [];
    const label = `theme "${theme}", credit ${i + 1} (${keys.join(", ") || "no keys"})`;
    if (keys.length === 0) failures.push(`${label}: credit names no asset keys.`);
    for (const field of ["title", "author", "url", "license"]) {
      if (!nonEmpty(c[field])) failures.push(`${label}: credit is missing "${field}".`);
    }
    if (nonEmpty(c.url) && !/^https?:\/\/\S+$/i.test(c.url)) {
      failures.push(`${label}: url must be an http(s) URL.`);
    }
    if (nonEmpty(c.license)) {
      const problem = licenseProblem(c.license);
      if (problem) failures.push(`${label}: ${problem}.`);
    }
    for (const key of keys) {
      if (!mapped.has(key)) {
        failures.push(`${label}: credit names "${key}", which the manifest does not map.`);
      }
      if (creditedBy.has(key)) {
        failures.push(`${label}: "${key}" is already credited by credit ${creditedBy.get(key)}.`);
      } else {
        creditedBy.set(key, i + 1);
      }
    }
  });
  // Under an attribution manifest license, every mapped key needs its own credit.
  if (nonEmpty(manifest.license) && !NO_ATTRIBUTION.has(manifest.license.trim())) {
    for (const key of mapped) {
      if (!creditedBy.has(key)) {
        failures.push(
          `theme "${theme}", key "${key}": license "${manifest.license.trim()}" requires attribution but the key has no credit.`,
        );
      }
    }
  }
}

const themeDirs = existsSync(THEMES_DIR)
  ? readdirSync(THEMES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
  : [];

for (const dirent of themeDirs) {
  const theme = dirent.name;
  const themeDir = join(THEMES_DIR, theme);
  const manifestPath = join(themeDir, "theme.json");
  const referenced = new Set();
  themeCount++;

  let manifest;
  if (!existsSync(manifestPath)) {
    failures.push(`theme "${theme}": no theme.json in ${rel(themeDir)}.`);
  } else {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (error) {
      failures.push(`theme "${theme}": ${rel(manifestPath)} is not valid JSON (${error.message}).`);
    }
  }

  if (manifest !== undefined) {
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
      failures.push(`theme "${theme}": manifest must be a JSON object.`);
      manifest = {};
    }
    if (!nonEmpty(manifest.license) || !nonEmpty(manifest.source)) {
      failures.push(`theme "${theme}": manifest lacks a license/source declaration.`);
    }
    if (manifest.id !== theme) {
      warnings.push(
        `theme "${theme}": manifest id is ${JSON.stringify(manifest.id)}, expected "${theme}".`,
      );
    }
    checkLicenses(theme, manifest);
    checkWater(theme, themeDir, manifest.water, referenced);
    const assets = manifest.assets ?? {};
    if (assets === null || typeof assets !== "object" || Array.isArray(assets)) {
      failures.push(`theme "${theme}": "assets" must be an object.`);
    } else {
      for (const [key, entry] of Object.entries(assets)) {
        const known = !knownKeys || knownKeys.includes(key);
        if (!known) {
          warnings.push(`theme "${theme}": unknown asset key "${key}" is ignored at runtime.`);
        }
        const fields = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
        // Unknown keys have no kind: check whichever file field they name.
        const kind = known && keyKinds ? keyKinds[key] : "image" in fields ? "flat" : "model";
        const field = kind === "flat" ? "image" : "model";
        const other = kind === "flat" ? "model" : "image";
        if (known && other in fields) {
          failures.push(
            `theme "${theme}", key "${key}": ${kind} key takes "${field}", not "${other}" (kind mismatch).`,
          );
        }
        if (known && kind === "flat") {
          const overrides = ["scale", "rotation", "offset"].filter((o) => o in fields);
          if (overrides.length > 0) {
            failures.push(
              `theme "${theme}", key "${key}": flat keys do not accept overrides (${overrides.join(", ")}).`,
            );
          }
        }
        if ("projection" in fields) {
          if (!["top", "isometric"].includes(fields.projection)) {
            failures.push(
              `theme "${theme}", key "${key}": projection must be "top" or "isometric".`,
            );
          } else if (known && !HEX_KEYS.has(key)) {
            failures.push(
              `theme "${theme}", key "${key}": only tile and sea images accept a "projection".`,
            );
          }
        }
        // Guard every file field present (also a mismatched one) against assets/ and
        // out-of-folder paths; only the field matching the kind must exist.
        if (!nonEmpty(fields[field]) && !(known && other in fields)) {
          failures.push(`theme "${theme}", key "${key}": entry has no "${field}" file.`);
        }
        for (const fileKind of [field, other]) {
          const file = fields[fileKind];
          if (nonEmpty(file)) {
            checkFile(theme, themeDir, key, fileKind, file, referenced, fields.projection);
          }
        }
      }
    }
  }

  for (const file of walk(themeDir)) {
    const ext = extname(file).toLowerCase();
    const type = MODEL_EXT.has(ext) ? "model" : IMAGE_EXT.has(ext) ? "image" : undefined;
    if (type && !referenced.has(file)) {
      failures.push(
        `theme "${theme}": ${type} file ${rel(file)} is not referenced by its manifest.`,
      );
    }
  }
}

// App icons (specs/web-metadata "App icon set"): only for the real client, not --themes fixtures.
if (themesArg === -1) {
  const PUBLIC_DIR = join(ROOT, "apps", "client", "public");
  const pngSize = (buf) =>
    buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG"
      ? [buf.readUInt32BE(16), buf.readUInt32BE(20)]
      : null;
  for (const [file, [w, h]] of Object.entries(ICON_OUTPUTS)) {
    const path = join(PUBLIC_DIR, file);
    if (!existsSync(path)) {
      failures.push(`icon ${file} is missing (run pnpm run icons:build).`);
      continue;
    }
    const buf = readFileSync(path);
    const size = pngSize(buf);
    if (!size || size[0] !== w || size[1] !== h) {
      failures.push(
        `icon ${file} must be a ${w}x${h} PNG (got ${size ? size.join("x") : "not a PNG"}).`,
      );
    }
    if (file === "og-image.png" && buf.length > OG_MAX_BYTES) {
      failures.push(`og-image.png is ${buf.length} bytes; the budget is ${OG_MAX_BYTES}.`);
    }
  }
  const ico = join(PUBLIC_DIR, "favicon.ico");
  if (!existsSync(ico)) failures.push("favicon.ico is missing (run pnpm run icons:build).");
  else {
    const buf = readFileSync(ico);
    const count = buf.length >= 6 && buf.readUInt16LE(2) === 1 ? buf.readUInt16LE(4) : 0;
    const sizes = Array.from({ length: count }, (_, i) => buf.readUInt8(6 + 16 * i) || 256);
    if (ICO_SIZES.some((s) => !sizes.includes(s))) {
      failures.push(
        `favicon.ico must hold ${ICO_SIZES.join("/")} px images (has ${sizes.join("/") || "none"}).`,
      );
    }
  }
  // Rules guide illustrations (openspec tutorial-mode-and-rules-guide, specs/rules-guide
  // "Illustrations are pre-generated assets"): one 960x540 WebP per section, named after
  // RULES_SECTIONS in apps/client/src/store/rulesGuide.ts, and nothing else in the folder.
  const RULES_DIR = join(PUBLIC_DIR, "rules");
  const RULES_IMAGES = [
    "goal",
    "setup",
    "turn",
    "production",
    "building",
    "robber",
    "devCards",
    "trading",
    "special",
    "winning",
  ].map((s) => `${s}.webp`);
  for (const file of RULES_IMAGES) {
    const path = join(RULES_DIR, file);
    if (!existsSync(path)) {
      failures.push(`rules image rules/${file} is missing (run pnpm run rules:art).`);
      continue;
    }
    imageCount++;
    const buf = readFileSync(path);
    const dim = imageSize(buf);
    if (buf.toString("ascii", 8, 12) !== "WEBP" || !dim) {
      failures.push(`rules image rules/${file} is not a readable WebP file.`);
    } else if (dim.width !== 960 || dim.height !== 540) {
      failures.push(`rules image rules/${file} is ${dim.width}x${dim.height}; it must be 960x540.`);
    }
    if (buf.length > IMAGE_BUDGET_BYTES) {
      warnings.push(
        `rules image rules/${file} is ${kb(buf.length)} (budget ~${kb(IMAGE_BUDGET_BYTES)}).`,
      );
    }
  }
  for (const file of existsSync(RULES_DIR) ? readdirSync(RULES_DIR) : []) {
    if (IMAGE_EXT.has(extname(file).toLowerCase()) && !RULES_IMAGES.includes(file)) {
      failures.push(`rules image rules/${file} is not one of the rules guide sections.`);
    }
  }
  for (const file of readdirSync(PUBLIC_DIR)) {
    if (/^(faivon|icon)\.png$/i.test(file)) {
      failures.push(
        `apps/client/public/${file}: the icon source lives in apps/client/brand/, not public/.`,
      );
    }
  }
}

for (const w of warnings) console.warn(`check-assets: warning: ${w}`);
if (failures.length > 0) {
  for (const f of failures) console.error(`check-assets: error: ${f}`);
  console.error(
    `check-assets: FAILED (${failures.length} error(s), ${warnings.length} warning(s)).`,
  );
  process.exit(1);
}
console.log(
  `check-assets: OK (${themeCount} theme(s), ${modelCount} model file(s), ${imageCount} image file(s), ${warnings.length} warning(s)).`,
);
