// Resource card art from the diorama terrain tiles (openspec change hud-tailwind-cards;
// specs/hud-presentation "Card art from the board's terrain"; design decision 4).
//
// For each resource it reads the matching tile from the theme manifest, crops a centered
// 5:7 rectangle that lies inside the hex, resizes it to 320 x 448, adds a soft vignette and
// writes WebP to apps/client/public/cards/<resource>.webp. Deterministic for a given sharp.
//
// It also writes the harbor badge art (openspec change harbor-icons): a centered square
// cut from each finished card, so a 2:1 harbor shows the same picture as its card, to
// apps/client/public/themes/diorama/harbors/<resource>.webp (mapped as harbor.<resource>).
//
// Usage: pnpm run cards:build   (or: node tools/cards-from-tiles.mjs)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const THEME_DIR = join(ROOT, "apps", "client", "public", "themes", "diorama");
const OUT_DIR = join(ROOT, "apps", "client", "public", "cards");
const HARBOR_DIR = join(THEME_DIR, "harbors");

/** Resource → terrain tile key (rules: Hills→Brick, Fields→Grain, ...). */
export const RESOURCE_TILES = {
  brick: "tile.hills",
  grain: "tile.fields",
  lumber: "tile.forest",
  ore: "tile.mountains",
  wool: "tile.pasture",
};

export const CARD_WIDTH = 320;
export const CARD_HEIGHT = 448;
export const MAX_BYTES = 60 * 1024;
/** Side of the square harbor badge image. */
export const HARBOR_SIZE = 256;
export const HARBOR_MAX_BYTES = 40 * 1024;

// sharp caches and threads can vary output timing but not bytes; keep it simple anyway.
sharp.cache(false);
sharp.concurrency(1);

/** Tile path (absolute) for a resource, read from the diorama manifest. */
export function tilePathFor(resource, themeDir = THEME_DIR) {
  const manifest = JSON.parse(readFileSync(join(themeDir, "theme.json"), "utf8"));
  const entry = manifest.assets?.[RESOURCE_TILES[resource]];
  if (!entry?.image)
    throw new Error(`cards: ${RESOURCE_TILES[resource]} has no image in the manifest`);
  return join(themeDir, entry.image);
}

/**
 * Largest centered 5:7 rectangle inside a pointy-top hex inscribed in a square tile of
 * side `size` (circumradius size/2), with a small safety margin. For 1024 px: 500 x 700.
 */
export function cropBox(size) {
  const r = size / 2;
  // A rectangle of half-width w and half-height h fits when h <= r - w * tan(30°).
  // With h = 1.4 w: w = r / (1.4 + tan 30°), less 2% for painted edges; width is
  // rounded down to a multiple of 10 so the box is exactly 5:7 and centered.
  const w = (r / (1.4 + Math.tan(Math.PI / 6))) * 0.98;
  const width = Math.floor((2 * w) / 10) * 10;
  const height = (width / 5) * 7;
  return { left: r - width / 2, top: r - height / 2, width, height };
}

const VIGNETTE = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">
  <defs><radialGradient id="v" cx="50%" cy="45%" r="70%">
    <stop offset="60%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.35"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`,
);

/** Builds one card image. Resolves to the WebP bytes. */
export async function buildCard(resource, themeDir = THEME_DIR) {
  const tile = sharp(readFileSync(tilePathFor(resource, themeDir)));
  const { width, height } = await tile.metadata();
  if (width !== height)
    throw new Error(`cards: tile for ${resource} is ${width}x${height}, not square`);
  const box = cropBox(width);

  // The crop must be fully opaque: transparent tile corners must never reach a card.
  const { data: alpha } = await sharp(readFileSync(tilePathFor(resource, themeDir)))
    .extract(box)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (alpha.some((v) => v < 255)) {
    throw new Error(`cards: crop of ${resource} tile has transparent pixels`);
  }

  const art = await tile
    .extract(box)
    .resize(CARD_WIDTH, CARD_HEIGHT, { kernel: "lanczos3" })
    .modulate({ saturation: 1.05 })
    .composite([{ input: VIGNETTE, blend: "over" }])
    .removeAlpha()
    .webp({ quality: 80, effort: 6, smartSubsample: false })
    .toBuffer();
  if (art.length > MAX_BYTES) {
    throw new Error(`cards: ${resource} card is ${art.length} bytes (max ${MAX_BYTES})`);
  }
  return art;
}

/**
 * Builds a harbor badge image from finished card bytes: the centered square of the card
 * (full width), resized to HARBOR_SIZE. Resolves to the WebP bytes.
 */
export async function buildHarbor(cardBytes) {
  const top = (CARD_HEIGHT - CARD_WIDTH) / 2;
  const art = await sharp(cardBytes)
    .extract({ left: 0, top, width: CARD_WIDTH, height: CARD_WIDTH })
    .resize(HARBOR_SIZE, HARBOR_SIZE, { kernel: "lanczos3" })
    .removeAlpha()
    .webp({ quality: 80, effort: 6, smartSubsample: false })
    .toBuffer();
  if (art.length > HARBOR_MAX_BYTES) {
    throw new Error(`cards: harbor image is ${art.length} bytes (max ${HARBOR_MAX_BYTES})`);
  }
  return art;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(HARBOR_DIR, { recursive: true });
  for (const resource of Object.keys(RESOURCE_TILES)) {
    const bytes = await buildCard(resource);
    const out = join(OUT_DIR, `${resource}.webp`);
    writeFileSync(out, bytes);
    console.log(`cards: ${resource} → ${out} (${(bytes.length / 1024).toFixed(1)} KB)`);
    const harbor = await buildHarbor(bytes);
    const harborOut = join(HARBOR_DIR, `${resource}.webp`);
    writeFileSync(harborOut, harbor);
    console.log(`cards: harbor ${resource} → ${harborOut} (${(harbor.length / 1024).toFixed(1)} KB)`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
