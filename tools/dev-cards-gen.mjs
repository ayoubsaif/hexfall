// Development card art (openspec settlecoast-parchment-ui). Generates one painted picture per
// development card type with the Gemini image API ("Nano Banana"), crops it to 5:7, resizes to
// 320 x 448 and writes WebP to apps/client/public/cards/dev/<card>.webp.
//
// Needs GEMINI_API_KEY in .env (gitignored). Optional GEMINI_IMAGE_MODEL
// (default gemini-nano-banana-2.1). Existing files are kept unless --force is passed.
//
// Usage: node tools/dev-cards-gen.mjs [--force] [card ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps", "client", "public", "cards", "dev");

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
  "Hand-painted storybook watercolor illustration, warm parchment palette, soft light, fine ink " +
  "outlines, charming board-game card art, vertical 5:7 composition, a single clear focal subject, " +
  "no text, no letters, no numbers, no border, no frame, no logo.";

export const CARDS = {
  knight:
    "A brave armored knight on horseback with a banner on a green hill, small castle in the distance.",
  roadBuilding:
    "Two workers laying a cobblestone road through a meadow with a wheelbarrow and tools, a winding path ahead.",
  yearOfPlenty:
    "An overflowing harvest cart of golden wheat, apples, grapes and sacks of grain in a sunny village square.",
  monopoly:
    "A merchant's wooden market stall piled with gold coins and goods, a chest of coins in front, a scale on the counter.",
  victoryPoint:
    "A golden laurel wreath and a shining trophy crest on a small stone podium, rays of light, a sunlit island below.",
};

export const CARD_WIDTH = 320;
export const CARD_HEIGHT = 448;

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
  for (const [card, subject] of Object.entries(CARDS)) {
    if (wanted.length > 0 && !wanted.includes(card)) continue;
    const out = join(OUT_DIR, `${card}.webp`);
    if (existsSync(out) && !force) {
      console.log(`skip ${card} (exists)`);
      continue;
    }
    console.log(`generating ${card} with ${model}…`);
    const raw = await generate(model, key, `${subject} ${STYLE}`);
    const webp = await sharp(raw)
      .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
    writeFileSync(out, webp);
    console.log(`wrote ${card}.webp (${webp.length} bytes)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e.message ?? e).replace(/key=[^&\s]+/g, "key=***"));
    process.exit(1);
  });
}
