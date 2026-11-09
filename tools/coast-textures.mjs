// Builds the coast textures in apps/client/public/textures/coast/ from the owner-downloaded CC0
// Poly Haven sets in assets/textures-src/ (1K JPGs, already seamless): scales each map to 512 px
// WebP and records the sources in SOURCE.json. The downloads stay in git-ignored assets/.
// Run: node tools/coast-textures.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets", "textures-src");
const OUT = join(ROOT, "apps", "client", "public", "textures", "coast");

/** slug -> output prefix and display name (all by Rob Tuytel, CC0, polyhaven.com). */
const SETS = [
  { slug: "mossy_rock", prefix: "mossy-rock", name: "Mossy Rock" },
  { slug: "aerial_grass_rock", prefix: "grass", name: "Aerial Grass Rock" },
  { slug: "coast_sand_01", prefix: "sand", name: "Coast Sand 01" },
];
/** Poly Haven map suffix -> our map name (only the colour maps are used in the shaders). */
const MAPS = { diff: "color" };

const source = JSON.parse(readFileSync(join(OUT, "SOURCE.json"), "utf8"));
const entries = (Array.isArray(source) ? source : [source]).filter(
  (e) => !SETS.some((s) => e.source?.endsWith(`/a/${s.slug}`)),
);

for (const set of SETS) {
  for (const [suffix, map] of Object.entries(MAPS)) {
    const src = join(SRC, `${set.slug}_${suffix}_1k.jpg`);
    if (!existsSync(src)) throw new Error(`coast-textures: missing ${src}`);
    const out = join(OUT, `${set.prefix}-${map}.webp`);
    const info = await sharp(src).resize(512, 512).webp({ quality: 82 }).toFile(out);
    console.log(`coast-textures: ${out} (${(info.size / 1024).toFixed(1)} KB)`);
  }
  entries.push({
    name: set.name,
    author: "Rob Tuytel",
    source: `https://polyhaven.com/a/${set.slug}`,
    license: "CC0-1.0",
    licenseUrl: "https://polyhaven.com/license",
    input: `Owner-downloaded 1K JPG maps (${Object.keys(MAPS).join(", ")})`,
    processing: `512px WebP ${Object.values(MAPS).join(", ")} maps (${set.prefix}-*.webp) by tools/coast-textures.mjs`,
  });
}
writeFileSync(join(OUT, "SOURCE.json"), `${JSON.stringify(entries, null, 2)}\n`);
