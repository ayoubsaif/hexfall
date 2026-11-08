// Resource icons (public/ui/resources/<resource>.webp, transparent 128 px) with the Gemini image
// API ("Nano Banana"). The sibling icons are sent as style references so a new one matches them.
// Gemini returns no alpha, so the subject is drawn on flat chroma green and keyed out.
// Needs GEMINI_API_KEY in .env. Usage: node tools/resource-icons-gen.mjs [--out DIR] [--force] [resource ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ICON_DIR = join(ROOT, "apps", "client", "public", "ui", "resources");

export function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const m = readFileSync(join(ROOT, ".env"), "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    return m?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const STYLE =
  "Match the painted game-icon style of the attached reference icons exactly: glossy stylized " +
  "cartoon game art, thick dark-brown outline, rich saturated colors, soft highlights, one clear " +
  "centered object filling most of the square frame, slight top-down 3/4 view. Draw it on a " +
  "perfectly flat solid pure green (#00FF00) background with no shadow, no ground, no gradient, " +
  "no text, no letters, no numbers, no border, no logo. Do not use green on the subject.";

export const ICONS = {
  wool: {
    subject:
      "A cute fluffy white cartoon sheep seen standing, thick curly woolly fleece, small dark " +
      "gray face with friendly eyes, little dark legs and ears.",
    refs: ["brick", "ore", "lumber", "grain"],
  },
};

/** Keys flat green to transparent, with a soft edge and the green spill removed. */
export async function keyOutGreen(input, size = 128) {
  const { data, info } = await sharp(input)
    .resize(size * 4, size * 4, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dom = g - Math.max(r, b); // how much greener than the other channels
    if (dom > 70) data[i + 3] = 0;
    else if (dom > 20) {
      data[i + 3] = Math.round(255 * (1 - (dom - 20) / 50));
      data[i + 1] = Math.max(r, b); // despill
    }
  }
  // Two pipelines: sharp applies only one resize per pipeline, and extend after it, so a single
  // chain came out size + 8 px.
  const trimmed = await sharp(data, { raw: info })
    .trim({ background: "#00000000", threshold: 1 })
    .png()
    .toBuffer();
  return sharp(trimmed)
    .resize(size - 8, size - 8, { fit: "contain", background: "#0000" })
    .extend({ top: 4, bottom: 4, left: 4, right: 4, background: "#0000" })
    .webp({ quality: 88, alphaQuality: 100 })
    .toBuffer();
}

export async function generate(model, key, prompt, refs) {
  const parts = [{ text: prompt }];
  for (const f of refs) {
    const png = await sharp(f).resize(256, 256).png().toBuffer();
    parts.push({ inlineData: { mimeType: "image/png", data: png.toString("base64") } });
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts }],
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
  const oi = args.indexOf("--out");
  const outDir = oi >= 0 ? resolve(args[oi + 1]) : ICON_DIR;
  const wanted = args.filter((a, i) => !a.startsWith("--") && i !== oi + 1);
  mkdirSync(outDir, { recursive: true });
  for (const [name, { subject, refs }] of Object.entries(ICONS)) {
    if (wanted.length > 0 && !wanted.includes(name)) continue;
    console.log(`generating ${name} icon with ${model}…`);
    const raw = await generate(
      model,
      key,
      `${subject} ${STYLE}`,
      refs.map((r) => join(ICON_DIR, `${r}.webp`)),
    );
    const webp = await keyOutGreen(raw);
    writeFileSync(join(outDir, `${name}.webp`), webp);
    console.log(`wrote ${name}.webp (${webp.length} bytes)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e.message ?? e).replace(/key=[^&\s]+/g, "key=***"));
    process.exit(1);
  });
}
