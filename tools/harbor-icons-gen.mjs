// Harbor sail icons (openspec settlecoast-parchment-ui). One stylized resource icon per harbor
// type with the Gemini image API ("Nano Banana"), text prompt only, 256x256 WebP in
// apps/client/public/textures/harbor/<type>.webp. Needs GEMINI_API_KEY in .env.
// Usage: node tools/harbor-icons-gen.mjs [--force] [type ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps", "client", "public", "textures", "harbor");

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
  "Single bold stylized cartoon game icon in clean colorful Fortnite-style game art, thick soft " +
  "outline, bright saturated colors, centered on a plain flat off-white cream background, " +
  "square composition, no text, no letters, no numbers, no border, no shadow, no logo.";

export const ICONS = {
  generic: "A small treasure chest overflowing with a mix of colorful gems and gold coins.",
  brick: "A neat stack of three red-orange clay bricks.",
  grain: "A golden wheat sheaf bundle tied with a string.",
  lumber: "Two stacked tree logs with visible rings and a small green leaf.",
  ore: "A cluster of gray rock chunks with shiny blue-silver ore crystals.",
  wool: "A fluffy white sheep wool ball with a small tuft, soft and round.",
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
  const force = args.includes("--force");
  const wanted = args.filter((a) => !a.startsWith("--"));
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [type, subject] of Object.entries(ICONS)) {
    if (wanted.length > 0 && !wanted.includes(type)) continue;
    const out = join(OUT_DIR, `${type}.webp`);
    if (existsSync(out) && !force) {
      console.log(`skip ${type} (exists)`);
      continue;
    }
    console.log(`generating ${type} with ${model}…`);
    const raw = await generate(model, key, `${subject} ${STYLE}`);
    const webp = await sharp(raw)
      .resize(256, 256, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();
    writeFileSync(out, webp);
    console.log(`wrote ${type}.webp (${webp.length} bytes)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e.message ?? e).replace(/key=[^&\s]+/g, "key=***"));
    process.exit(1);
  });
}
