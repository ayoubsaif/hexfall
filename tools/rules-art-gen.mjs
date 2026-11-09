// Rules guide illustrations (openspec tutorial-mode-and-rules-guide, design decision 7). One
// painted landscape picture per rules section, generated with the Gemini image API in the same
// style as the development card art, cropped to 16:9, resized to 960 x 540 and written as WebP to
// apps/client/public/rules/<section>.webp. The client only serves these files; it never calls
// Gemini.
//
// Needs GEMINI_API_KEY in .env (gitignored). Optional GEMINI_IMAGE_MODEL
// (default gemini-nano-banana-2.1). Existing files are kept unless --force is passed.
// --list prints the sections without calling the API.
//
// Usage: node tools/rules-art-gen.mjs [--force] [--list] [section ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps", "client", "public", "rules");

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
  "outlines, charming board-game art, wide 16:9 landscape composition, a single clear scene, " +
  "no text, no letters, no numbers, no border, no frame, no logo, no user interface.";

/** Section id (matches the client's rules guide sections) → scene. */
export const SECTIONS = {
  goal: "A small hexagon-tiled island of forests, pastures, golden fields, clay hills and grey mountains surrounded by a calm sea, wooden village houses and roads, seen from above at a slight angle.",
  setup:
    "Two small wooden houses with a short wooden road beside each, being placed by a hand onto the corners where hexagonal land tiles meet on a tabletop island.",
  turn: "Two ivory dice tumbling across a wooden table beside a hexagon island board, motion and warm candle light.",
  production:
    "Hexagonal tiles of forest, pasture, field, clay hill and mountain, each with a small bundle of its goods (logs, wool, wheat sheaf, bricks, ore) floating up toward a nearby village house.",
  building:
    "Villagers building: a wooden road, a small cottage and a larger stone town hall with towers, with stacks of bricks, logs, wool and wheat beside them.",
  robber:
    "A hooded dark grey robber figure standing on a desert hexagon tile at dusk, a village nearby with a sack of goods being carried away.",
  devCards:
    "A fan of five illustrated playing cards on a wooden table: a knight, a road crew, a harvest cart, a merchant stall and a golden laurel, blank card backs.",
  trading:
    "Two merchants shaking hands at a harbor dock, crates of wool and wheat and bricks exchanged, a sailing ship moored behind them.",
  special:
    "A long winding cobblestone road across green hills on one side and a proud army of three knights with banners on the other side.",
  winning:
    "A joyful village celebration with banners, a golden laurel wreath raised high above a thriving island town at sunset, fireworks of light.",
};

export const WIDTH = 960;
export const HEIGHT = 540;

async function generate(model, key, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
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
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    for (const s of Object.keys(SECTIONS)) console.log(s);
    return;
  }
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not set (.env)");
  const model = env("GEMINI_IMAGE_MODEL") || "gemini-nano-banana-2.1";
  const { default: sharp } = await import("sharp");
  const force = args.includes("--force");
  const wanted = args.filter((a) => !a.startsWith("--"));
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [section, scene] of Object.entries(SECTIONS)) {
    if (wanted.length > 0 && !wanted.includes(section)) continue;
    const out = join(OUT_DIR, `${section}.webp`);
    if (existsSync(out) && !force) {
      console.log(`skip ${section} (exists)`);
      continue;
    }
    console.log(`generating ${section} with ${model}…`);
    const raw = await generate(model, key, `${scene} ${STYLE}`);
    const webp = await sharp(raw)
      .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .toBuffer();
    writeFileSync(out, webp);
    console.log(`wrote ${section}.webp (${webp.length} bytes)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e.message ?? e).replace(/key=[^&\s]+/g, "key=***"));
    process.exit(1);
  });
}
