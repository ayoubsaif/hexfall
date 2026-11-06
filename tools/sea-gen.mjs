// Sea + coast textures (openspec realistic-sea-and-coast-textures).
// Generates stylized top-down water caustics and beach sand with the Gemini image API from text
// prompts only (no reference images), forces seamless tiling with an offset cross-fade, and writes
// candidates plus a 3x3 tile-test sheet to an output directory for owner approval.
//
// Needs GEMINI_API_KEY in .env (gitignored). Optional GEMINI_IMAGE_MODEL.
// Usage: node tools/sea-gen.mjs <outDir> [--only water|caustics|sand] [--count 2]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 512;

function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const m = readFileSync(join(ROOT, ".env"), "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    return m?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const COMMON =
  "square composition, perfectly flat top-down view, even lighting, edges that tile seamlessly, " +
  "no text, no letters, no people, no objects, no border, no vignette, no logo.";

export const PROMPTS = {
  water:
    "Seamless tileable top-down texture of shallow tropical lagoon water for a stylized 3D game: " +
    "glassy luminous turquoise and aqua, soft sunlit caustic light network, gentle ripples, " +
    "clean painterly gradients, no foam, no horizon, " +
    COMMON,
  caustics:
    "Seamless tileable top-down grayscale water caustics height map: soft rounded bright light " +
    "cells separated by thin darker lines, smooth low-contrast mid-gray base, black and white " +
    "only, " +
    COMMON,
  sand:
    "Seamless tileable top-down warm golden beach sand texture for a stylized 3D game: fine soft " +
    "grain, faint gentle wind ripples, painterly soft gradients, bright but gentle colors, no " +
    "shells, no pebbles, no footprints, " +
    COMMON,
};

async function generate(model, key, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(part.inlineData.data, "base64");
}

/** Make an RGB image tile: blend it with a half-size-rolled copy, weighted 0 at the edges. */
export async function makeSeamless(buf, size = SIZE) {
  const { data } = await sharp(buf)
    .resize(size, size, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  const h = size / 2;
  const w1 = (i) => {
    // 0 at the edge, 1 at the center, smooth.
    const t = 1 - Math.abs(i - h) / h;
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wgt = Math.min(w1(x), w1(y)) ** 0.5;
      const rx = (x + h) % size;
      const ry = (y + h) % size;
      for (let c = 0; c < 3; c++) {
        const a = data[(y * size + x) * 3 + c];
        const b = data[(ry * size + rx) * 3 + c];
        out[(y * size + x) * 3 + c] = Math.round(a * wgt + b * (1 - wgt));
      }
    }
  }
  return sharp(out, { raw: { width: size, height: size, channels: 3 } });
}

async function tileSheet(img, file) {
  const png = await img.clone().png().toBuffer();
  const s = SIZE;
  await sharp({ create: { width: s * 3, height: s * 3, channels: 3, background: "#000" } })
    .composite(
      Array.from({ length: 9 }, (_, i) => ({
        input: png,
        left: (i % 3) * s,
        top: Math.floor(i / 3) * s,
      })),
    )
    .resize(1024, 1024)
    .png()
    .toFile(file);
}

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("usage: node tools/sea-gen.mjs <outDir> [--only name] [--count n]");
  const flag = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
  const only = flag("--only");
  const count = Number(flag("--count", "2"));
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not set (.env)");
  const model = env("GEMINI_IMAGE_MODEL") || "gemini-nano-banana-2.1";
  mkdirSync(out, { recursive: true });
  for (const [name, prompt] of Object.entries(PROMPTS)) {
    if (only && only !== name) continue;
    for (let i = 1; i <= count; i++) {
      console.log(`generating ${name} #${i} with ${model}…`);
      const raw = await generate(model, key, prompt);
      let img = await makeSeamless(raw);
      if (name === "caustics") img = img.greyscale();
      const base = join(out, `${name}-${i}`);
      const webp = await img.clone().webp({ quality: 82 }).toBuffer();
      writeFileSync(`${base}.webp`, webp);
      await tileSheet(img, `${base}-tiled.png`);
      console.log(`  ${base}.webp (${webp.length} bytes) + ${base}-tiled.png`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e.message ?? e).replace(/key=[^&\s]+/g, "key=***"));
    process.exit(1);
  });
}
