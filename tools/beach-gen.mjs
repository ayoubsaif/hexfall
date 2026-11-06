// Beach sand texture for the shallows around the island (openspec settlecoast-parchment-ui).
// Generates a stylized, seamless top-down sand picture with the Gemini image API ("Nano Banana")
// from a text prompt only (no reference images) and writes apps/client/public/textures/sand.webp.
//
// Needs GEMINI_API_KEY in .env (gitignored). Optional GEMINI_IMAGE_MODEL.
// Usage: node tools/beach-gen.mjs [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "apps", "client", "public", "textures", "sand.webp");

function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const m = readFileSync(join(ROOT, ".env"), "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    return m?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

export const PROMPT =
  "Seamless tileable top-down beach sand texture for a stylized 3D cartoon game, in the clean " +
  "colorful look of Fortnite-style stylized game art: smooth warm golden-yellow sand with soft " +
  "gentle wave ripple lines, a few tiny pale seashells and small pebbles scattered sparsely, " +
  "soft painterly gradients, bright saturated but gentle colors, flat even lighting with no " +
  "shadows, square composition, edges that tile seamlessly, no text, no letters, no people, " +
  "no objects larger than a pebble, no border, no logo.";

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
  if (existsSync(OUT) && !process.argv.includes("--force")) {
    console.log("skip sand.webp (exists; --force to regenerate)");
    return;
  }
  console.log(`generating sand with ${model}…`);
  const raw = await generate(model, key, PROMPT);
  mkdirSync(dirname(OUT), { recursive: true });
  const webp = await sharp(raw).resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  writeFileSync(OUT, webp);
  console.log(`wrote sand.webp (${webp.length} bytes)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e.message ?? e).replace(/key=[^&\s]+/g, "key=***"));
    process.exit(1);
  });
}
