// Builds apps/client/public/textures/soil.webp (the hex block side texture) from
// docs/art/sources/soil/soil.jpg: crops the plain border, scales to 512 px, writes WebP.
// Run: node tools/soil-texture.mjs
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(ROOT, "docs", "art", "sources", "soil", "soil.jpg");
const out = join(ROOT, "apps", "client", "public", "textures", "soil.webp");
const CROP = 50; // px of flat border to drop on every side of the 980 px source
const info = await sharp(src)
  .extract({ left: CROP, top: CROP, width: 980 - 2 * CROP, height: 980 - 2 * CROP })
  .resize(512, 512)
  .webp({ quality: 82 })
  .toFile(out);
console.log(`soil-texture: ${out} (${(info.size / 1024).toFixed(1)} KB)`);
