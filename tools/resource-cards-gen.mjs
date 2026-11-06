// Resource card illustrations (openspec settlecoast-parchment-ui). One painted picture per
// resource with the Gemini image API ("Nano Banana"), text prompt only (no reference images),
// cropped to 5:7, 320 x 448 WebP in apps/client/public/cards/<resource>.webp. The card frame and
// corner icons are drawn by the client (GameCard), so the art has no border.
// Needs GEMINI_API_KEY in .env. Usage: node tools/resource-cards-gen.mjs [--force] [resource ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps", "client", "public", "cards");
const MAX_BYTES = 60 * 1024;

function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const m = readFileSync(join(ROOT, ".env"), "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    return m?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const STYLE =
  "Hand-painted storybook game-card illustration, warm saturated colors, soft light, fine ink " +
  "outlines, charming stylized cartoon look, vertical 5:7 composition, one clear centered focal " +
  "subject filling the frame, full-bleed scene with no border, no frame, no text, no letters, " +
  "no numbers, no logo.";

export const RESOURCES = {
  brick:
    "A rustic wooden wheelbarrow loaded with stacked red-orange clay bricks, standing on arid " +
    "dry soil with clay-colored hills behind it.",
  wool: "A fluffy cute cartoon sheep standing in the middle of a green flowery meadow under a blue sky.",
  ore:
    "A mining cart on rails carrying a large veined block of mineral ore, jagged rocky mountain " +
    "peaks in the background.",
  lumber:
    "A symmetrical pile of cylindrical cut logs resting on a tree stump that sprouts a small " +
    "shoot of green leaves, in a forest clearing.",
  grain:
    "A bundle sheaf of golden wheat tied in the middle with rustic rope, beside a wooden fence, " +
    "at sunset.",
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

async function main() {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not set (.env)");
  const model = env("GEMINI_IMAGE_MODEL") || "gemini-nano-banana-2.1";
  const args = process.argv.slice(2);
  const wanted = args.filter((a) => !a.startsWith("--"));
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, subject] of Object.entries(RESOURCES)) {
    if (wanted.length > 0 && !wanted.includes(name)) continue;
    const out = join(OUT_DIR, `${name}.webp`);
    if (existsSync(out) && !args.includes("--force")) {
      console.log(`skip ${name} (exists; --force)`);
      continue;
    }
    console.log(`generating ${name} with ${model}…`);
    const raw = await generate(model, key, `${subject} ${STYLE}`);
    let webp;
    for (const q of [82, 72, 62, 52]) {
      webp = await sharp(raw)
        .resize(320, 448, { fit: "cover", position: "centre" })
        .webp({ quality: q })
        .toBuffer();
      if (webp.length <= MAX_BYTES) break;
    }
    writeFileSync(out, webp);
    console.log(`wrote ${name}.webp (${webp.length} bytes)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e.message ?? e).replace(/key=[^&\s]+/g, "key=***"));
    process.exit(1);
  });
}
