// App icons and the Open Graph image from one source (openspec change turn-sound-and-push;
// specs/web-metadata "App icon set", "Open Graph image").
//
// Reads apps/client/brand/icon.png (square, transparent) and writes into apps/client/public/:
//   favicon.ico (16/32/48), icons/favicon-32.png, icons/apple-touch-icon.png (180, opaque),
//   icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png (opaque, art at 70 % so it fits the 80 % safe
//   circle), icons/badge-96.png (white silhouette) and og-image.png (1200 x 630).
// The outputs are committed, so normal builds never run this.
//
// Usage: pnpm run icons:build   (or: node tools/icons.mjs)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ICO_SIZES, ICON_OUTPUTS } from "./icon-list.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = join(ROOT, "apps", "client", "brand", "icon.png");
const PUBLIC = join(ROOT, "apps", "client", "public");

/** App background (style.css --color-hud-solid) and accent (--color-accent). */
export const BACKGROUND = "#0f2230";
export const ACCENT = "#f2a65a";

export const OUTPUTS = ICON_OUTPUTS;
export { ICO_SIZES };

const png = (img) => img.png({ compressionLevel: 9, palette: false }).toBuffer();

/** The artwork resized to `size`, transparent. */
function art(size) {
  return sharp(SOURCE).resize(size, size, { fit: "contain", background: "#0000" });
}

/** The artwork at `scale` of `size`, centered on an opaque background. */
async function onBackground(size, scale) {
  const inner = Math.round(size * scale);
  const pad = Math.floor((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: await art(inner).png().toBuffer(), left: pad, top: pad }])
    .png();
}

/** White silhouette from the alpha channel (Android status bar badge). */
async function badge(size) {
  const alpha = await art(size).ensureAlpha().extractChannel("alpha").toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } })
    .joinChannel(alpha)
    .png();
}

/** 1200 x 630: gradient background, artwork left, wordmark right. */
async function ogImage() {
  const [w, h] = OUTPUTS["og-image.png"];
  const iconSize = 460;
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#16364a"/><stop offset="1" stop-color="${BACKGROUND}"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="640" y="320" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif"
        font-size="132" font-weight="700" fill="#e9efe6">Hexfall</text>
      <text x="644" y="392" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif"
        font-size="38" fill="${ACCENT}">Build, trade, settle.</text>
    </svg>`,
  );
  return sharp(bg)
    .composite([
      { input: await art(iconSize).png().toBuffer(), left: 110, top: (h - iconSize) / 2 },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 90 });
}

/** ICO container holding PNG images (supported by every current browser). */
export function icoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

export async function buildIcons(outDir = PUBLIC) {
  mkdirSync(join(outDir, "icons"), { recursive: true });
  const write = (rel, buf) => writeFileSync(join(outDir, rel), buf);
  write("icons/favicon-32.png", await png(art(32)));
  write("icons/apple-touch-icon.png", await (await onBackground(180, 0.88)).toBuffer());
  write("icons/icon-192.png", await png(art(192)));
  write("icons/icon-512.png", await png(art(512)));
  write("icons/icon-maskable-512.png", await (await onBackground(512, 0.7)).toBuffer());
  write("icons/badge-96.png", await (await badge(96)).toBuffer());
  write("og-image.png", await (await ogImage()).toBuffer());
  const ico = [];
  for (const size of ICO_SIZES) ico.push({ size, data: await png(art(size)) });
  write("favicon.ico", icoFromPngs(ico));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildIcons();
  console.log("icons written to apps/client/public/");
}
