// Reference-art guard + theme validation + asset budget check (tasks 2.6, 6.7;
// design.md decision 10; specs/asset-theming "Asset budget check", "Licensing guard").
//
// Fails (exit 1) when:
//   - a text file under apps/ or packages/ references the repo-root reference folder
//     assets/ (a path that resolves to it, an absolute path into it, or one of its file names)
//   - a theme folder in apps/client/public/themes/ holds a model file its manifest does not reference
//   - a manifest is unreadable, lacks a license/source, or references a missing file,
//     a path outside its theme folder, or a file under assets/
// Warns (exit 0) on a referenced GLB that is not Draco/meshopt compressed or exceeds 300 KB.
// No dependencies: plain Node ESM.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REF_DIR = join(ROOT, "assets");
const THEMES_DIR = join(ROOT, "apps", "client", "public", "themes");
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
const BUDGET_BYTES = 300 * 1024;
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
// extension-less stem is matched too when it is long enough to be unambiguous.
const refFiles = existsSync(REF_DIR)
  ? [...walk(REF_DIR)].map((f) => {
      const name = basename(f).toLowerCase();
      const stem = name.slice(0, name.length - extname(name).length);
      return { name, stem: stem.length >= 8 ? stem : name };
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
// 2. Theme manifests, orphan model files and asset budget.

let knownKeys;
try {
  // Node 24 strips types natively; keys.ts uses erasable syntax only.
  ({ ASSET_KEYS: knownKeys } = await import("../apps/client/src/theme/keys.ts"));
} catch {
  knownKeys = undefined;
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
let themeCount = 0;
let modelCount = 0;

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
    const assets = manifest.assets ?? {};
    if (assets === null || typeof assets !== "object" || Array.isArray(assets)) {
      failures.push(`theme "${theme}": "assets" must be an object.`);
    } else {
      for (const [key, entry] of Object.entries(assets)) {
        if (knownKeys && !knownKeys.includes(key)) {
          warnings.push(`theme "${theme}": unknown asset key "${key}" is ignored at runtime.`);
        }
        const model = entry && typeof entry === "object" ? entry.model : undefined;
        if (!nonEmpty(model)) {
          failures.push(`theme "${theme}", key "${key}": entry has no "model" file.`);
          continue;
        }
        const target =
          isAbsolute(model) || /^[a-z]:/i.test(model)
            ? resolve(model)
            : resolve(themeDir, model.replace(/^\/+/, ""));
        const lowerName = basename(model).toLowerCase();
        // Into assets/: resolves there, names one of its files, or is an absolute or
        // parent-relative path through an "assets" segment (e.g. "/assets/x.glb").
        const escapesViaAssets =
          /(^|[\\/])assets[\\/]/i.test(model) && /\.\.|^[\\/]|^[a-z]:/i.test(model);
        if (isInside(target, REF_DIR) || escapesViaAssets || refNames.includes(lowerName)) {
          failures.push(
            `theme "${theme}", key "${key}": "${model}" points into the reference folder assets/.`,
          );
          continue;
        }
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(model) || !isInside(target, themeDir)) {
          failures.push(`theme "${theme}", key "${key}": "${model}" is outside the theme folder.`);
          continue;
        }
        referenced.add(target);
        if (!existsSync(target) || !statSync(target).isFile()) {
          failures.push(
            `theme "${theme}", key "${key}": file "${model}" does not exist (${rel(target)}).`,
          );
          continue;
        }
        modelCount++;
        const size = statSync(target).size;
        if (size > BUDGET_BYTES) {
          warnings.push(
            `theme "${theme}", key "${key}": ${model} is ${kb(size)} (budget ~${kb(BUDGET_BYTES)}).`,
          );
        }
        if (extname(target).toLowerCase() !== ".glb") {
          warnings.push(`theme "${theme}", key "${key}": ${model} (${kb(size)}) is not a GLB.`);
          continue;
        }
        const glb = inspectGlb(target);
        if (glb.error) {
          warnings.push(
            `theme "${theme}", key "${key}": ${model} (${kb(size)}) ${glb.error}; it will fall back at runtime.`,
          );
        } else if (!glb.compressed) {
          warnings.push(
            `theme "${theme}", key "${key}": ${model} (${kb(size)}) is not Draco/meshopt compressed.`,
          );
        }
      }
    }
  }

  for (const file of walk(themeDir)) {
    if (MODEL_EXT.has(extname(file).toLowerCase()) && !referenced.has(file)) {
      failures.push(`theme "${theme}": model file ${rel(file)} is not referenced by its manifest.`);
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
  `check-assets: OK (${themeCount} theme(s), ${modelCount} model file(s), ${warnings.length} warning(s)).`,
);
