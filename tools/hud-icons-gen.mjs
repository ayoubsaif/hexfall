// HUD button icons (public/ui/icons/<name>.webp, transparent 128 px) with the Gemini image API.
// Existing HUD icons are sent as style references so a new one matches the set, and the subject
// is drawn on flat chroma green and keyed out (see resource-icons-gen.mjs).
// Needs GEMINI_API_KEY in .env. Write candidates elsewhere first to review them:
//   node tools/hud-icons-gen.mjs --out <dir> [--force] [name ...]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env, generate, keyOutGreen } from "./resource-icons-gen.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ICON_DIR = join(ROOT, "apps", "client", "public", "ui", "icons");

const STYLE =
  "Match the painted HUD icon style of the attached reference icons exactly: flat cel-shaded " +
  "cartoon game art, thick dark-brown outline, muted earthy palette (warm wood browns, " +
  "parchment beige, soft brass), simple shapes, one clear centered object filling most of the " +
  "square frame. Draw it on a perfectly flat solid pure green (#00FF00) background with no " +
  "shadow, no ground, no gradient, no text, no letters, no numbers, no border, no logo. Do not " +
  "use green on the subject.";

/** Style references: the icons that sit next to the new ones in the game menus. */
const REFS = ["pause", "flag", "leave", "endturn"];

export const ICONS = {
  resume: {
    subject:
      "A single right-pointing play triangle carved from warm brown wood with visible grain and " +
      "rounded corners, the same wood as two pause bars, seen straight on.",
  },
  home: {
    subject:
      "A small cozy cottage with a peaked brown roof, a wooden door and one round window, seen " +
      "straight on, a simple home.",
  },
  "end-game": {
    subject:
      "A small brass trophy cup with two handles on a short dark wooden base, seen straight on, " +
      "a simple victory trophy.",
  },
};

async function main() {
  const args = process.argv.slice(2);
  const oi = args.indexOf("--out");
  const outDir = oi >= 0 ? resolve(args[oi + 1]) : ICON_DIR;
  const force = args.includes("--force");
  const wanted = args.filter((a, i) => !a.startsWith("--") && (oi < 0 || i !== oi + 1));
  for (const name of wanted) {
    if (!(name in ICONS))
      throw new Error(`unknown icon "${name}" (known: ${Object.keys(ICONS).join(", ")})`);
  }
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not set (add it to .env)");
  const model = env("GEMINI_IMAGE_MODEL") || "gemini-nano-banana-2.1";
  mkdirSync(outDir, { recursive: true });
  for (const [name, { subject }] of Object.entries(ICONS)) {
    if (wanted.length > 0 && !wanted.includes(name)) continue;
    const file = join(outDir, `${name}.webp`);
    if (existsSync(file) && !force) {
      console.log(`skip ${name}: ${file} exists (use --force)`);
      continue;
    }
    console.log(`generating ${name} icon with ${model}…`);
    const raw = await generate(
      model,
      key,
      `${subject} ${STYLE}`,
      REFS.map((r) => join(ICON_DIR, `${r}.webp`)),
    );
    const webp = await keyOutGreen(raw);
    writeFileSync(file, webp);
    console.log(`wrote ${file} (${webp.length} bytes)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e.message ?? e).replace(/key=[^&\s]+/g, "key=***"));
    process.exit(1);
  });
}
