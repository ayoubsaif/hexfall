// Builds the "minimal" theme's tile SVGs (original flat-vector art, CC0-1.0).
// Terrains use the isometric format (docs/art/README.md): 1024 x 1088, top face in the
// top 1024 x 1024, 64 px earth band below. The sea is a 1024 x 1024 top-down image.
// Usage: node docs/art/minimal/build.mjs  -> writes <terrain>.svg next to this file.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const SQUASH = Math.sin(Math.PI / 3); // ground foreshortening at 60 deg elevation

// Small seeded RNG so the art rebuilds identically.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEX = "512,0 1024,256 1024,768 512,1024 0,768 0,256";
const f = (n) => n.toFixed(1);

/** Inside the top face, inset by `m` px (pointy-top hex, squashed). */
function inHex(x, y, m) {
  const dx = Math.abs(x - 512);
  const dy = Math.abs(y - 512);
  if (dx > 512 - m) return false;
  // slanted edge: from (512,0) to (1024,256) => dy <= 512 - dx/2
  return dy <= 512 - dx / 2 - m;
}
/** Keep the token ellipse and the robber spot calm. */
function calm(x, y, pad) {
  const t = ((x - 512) / (177 + pad)) ** 2 + ((y - 512) / (154 + pad)) ** 2;
  const r = ((x - 246) / (70 + pad * 0.5)) ** 2 + ((y - 666) / (62 + pad * 0.5)) ** 2;
  return t < 1 || r < 1;
}
/** Scatter points over the top face, sorted back to front. */
function scatter(seed, count, { inset = 70, pad = 40, minGap = 70, top = 110 } = {}) {
  const rand = rng(seed);
  const pts = [];
  for (let tries = 0; pts.length < count && tries < count * 400; tries++) {
    const x = rand() * 1024;
    const y = rand() * 1024;
    if (y < top || !inHex(x, y, inset) || calm(x, y, pad)) continue;
    if (pts.some((p) => Math.hypot(p.x - x, (p.y - y) / SQUASH) < minGap)) continue;
    pts.push({ x, y, k: rand() });
  }
  return pts.sort((a, b) => a.y - b.y);
}

function tile({ ground, groundDark, soil, soilDark, details }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1088" viewBox="0 0 1024 1088">
  <rect width="1024" height="1024" fill="${ground}"/>
  <polygon points="${HEX}" fill="${ground}" stroke="${groundDark}" stroke-width="10" stroke-opacity="0.35"/>
  <polygon points="0,768 512,1024 512,1088 0,832" fill="${soil}"/>
  <polygon points="512,1024 1024,768 1024,832 512,1088" fill="${soilDark}"/>
  <polygon points="0,768 512,1024 512,1040 0,784" fill="${groundDark}"/>
  <polygon points="512,1024 1024,768 1024,784 512,1040" fill="${groundDark}" opacity="0.85"/>
  ${details}
</svg>
`;
}

const shadow = (x, y, rx, o = 0.18) =>
  `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx * SQUASH * 0.45)}" fill="#000" opacity="${o}"/>`;

function forest() {
  const trees = scatter(11, 22, { minGap: 92 })
    .map(({ x, y, k }) => {
      const s = 0.8 + k * 0.45;
      const w = 46 * s;
      const h = 120 * s;
      const c = k > 0.5 ? "#2f6b34" : "#3a7d3c";
      return `${shadow(x, y, w * 0.9)}
  <rect x="${f(x - 6 * s)}" y="${f(y - 18 * s)}" width="${f(12 * s)}" height="${f(20 * s)}" fill="#6b4a2b"/>
  <polygon points="${f(x - w)},${f(y - 14 * s)} ${f(x)},${f(y - h)} ${f(x + w)},${f(y - 14 * s)}" fill="${c}"/>
  <polygon points="${f(x)},${f(y - h)} ${f(x + w)},${f(y - 14 * s)} ${f(x)},${f(y - 14 * s)}" fill="#000" opacity="0.14"/>`;
    })
    .join("\n  ");
  return tile({
    ground: "#5f9a4a",
    groundDark: "#47803a",
    soil: "#6b4f33",
    soilDark: "#5a4129",
    details: trees,
  });
}

function pasture() {
  const tufts = scatter(21, 30, { minGap: 60, pad: 20 })
    .map(({ x, y }) => `<path d="M${f(x - 14)} ${f(y)} l6 -18 l4 18 l6 -24 l4 24 l6 -16 l4 16" fill="none" stroke="#7fb04a" stroke-width="5" stroke-linejoin="round"/>`)
    .join("\n  ");
  const sheep = scatter(22, 6, { minGap: 160, pad: 50 })
    .map(({ x, y, k }) => {
      const d = k > 0.5 ? 1 : -1;
      return `${shadow(x, y + 4, 40)}
  <rect x="${f(x - 18)}" y="${f(y - 18)}" width="7" height="20" rx="3" fill="#3b3b3b"/>
  <rect x="${f(x + 11)}" y="${f(y - 18)}" width="7" height="20" rx="3" fill="#3b3b3b"/>
  <ellipse cx="${f(x)}" cy="${f(y - 34)}" rx="36" ry="24" fill="#f6f3ea"/>
  <ellipse cx="${f(x + d * 34)}" cy="${f(y - 42)}" rx="13" ry="11" fill="#3b3b3b"/>`;
    })
    .join("\n  ");
  return tile({
    ground: "#a6cf63",
    groundDark: "#8cb84f",
    soil: "#6b4f33",
    soilDark: "#5a4129",
    details: `${tufts}\n  ${sheep}`,
  });
}

function fields() {
  // Crop rows run diagonally; gaps leave the token and robber areas plain.
  const rows = [];
  for (let i = -12; i <= 12; i++) {
    const off = i * 70;
    rows.push(
      `<line x1="${f(off - 200)}" y1="1100" x2="${f(off + 900)}" y2="-60" stroke="#c99a2e" stroke-width="16" stroke-linecap="round" opacity="0.55"/>`,
    );
  }
  const calmMask = `<ellipse cx="512" cy="512" rx="205" ry="180" fill="#e7bf4f"/>
  <ellipse cx="246" cy="666" rx="84" ry="72" fill="#e7bf4f"/>`;
  const stalks = scatter(31, 14, { minGap: 110, pad: 50 })
    .map(({ x, y }) => `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y - 70)}" stroke="#a87a1f" stroke-width="6"/>
  <ellipse cx="${f(x)}" cy="${f(y - 80)}" rx="10" ry="22" fill="#f3d36b"/>`)
    .join("\n  ");
  return tile({
    ground: "#e7bf4f",
    groundDark: "#cfa53a",
    soil: "#7a5a36",
    soilDark: "#65492b",
    details: `<g>${rows.join("")}</g>\n  ${calmMask}\n  ${stalks}`,
  });
}

function hills() {
  const mounds = scatter(41, 9, { minGap: 170, pad: 30, inset: 110 })
    .map(({ x, y, k }) => {
      const w = 90 + k * 50;
      return `<path d="M${f(x - w)} ${f(y)} Q${f(x)} ${f(y - w * 1.3)} ${f(x + w)} ${f(y)} Z" fill="#b8573a"/>
  <path d="M${f(x)} ${f(y - w * 0.65)} Q${f(x + w * 0.6)} ${f(y - w * 0.5)} ${f(x + w)} ${f(y)} L${f(x)} ${f(y)} Z" fill="#000" opacity="0.12"/>`;
    })
    .join("\n  ");
  const bricks = scatter(42, 5, { minGap: 200, pad: 60 })
    .map(({ x, y }) => {
      const b = (dx, dy) =>
        `<rect x="${f(x + dx)}" y="${f(y + dy)}" width="34" height="16" fill="#e0794f" stroke="#8f3f26" stroke-width="3"/>`;
      return `${shadow(x + 17, y + 2, 48)}${b(-34, -16)}${b(0, -16)}${b(-17, -32)}`;
    })
    .join("\n  ");
  return tile({
    ground: "#d27a52",
    groundDark: "#b9623f",
    soil: "#7a4630",
    soilDark: "#653826",
    details: `${mounds}\n  ${bricks}`,
  });
}

function mountains() {
  const peaks = scatter(51, 8, { minGap: 190, pad: 30, inset: 120, top: 200 })
    .map(({ x, y, k }) => {
      const w = 95 + k * 45;
      const h = w * 1.55;
      const sx = w * 0.32;
      return `${shadow(x, y, w)}
  <polygon points="${f(x - w)},${f(y)} ${f(x)},${f(y - h)} ${f(x + w)},${f(y)}" fill="#8b93a3"/>
  <polygon points="${f(x)},${f(y - h)} ${f(x + w)},${f(y)} ${f(x + w * 0.1)},${f(y)}" fill="#6c7383"/>
  <polygon points="${f(x - sx)},${f(y - h + h * 0.32)} ${f(x)},${f(y - h)} ${f(x + sx)},${f(y - h + h * 0.32)} ${f(x + sx * 0.3)},${f(y - h + h * 0.26)} ${f(x - sx * 0.2)},${f(y - h + h * 0.34)}" fill="#f4f6f8"/>`;
    })
    .join("\n  ");
  const rocks = scatter(52, 10, { minGap: 90, pad: 20 })
    .map(({ x, y }) => `<path d="M${f(x - 16)} ${f(y)} L${f(x - 8)} ${f(y - 16)} L${f(x + 10)} ${f(y - 14)} L${f(x + 16)} ${f(y)} Z" fill="#7d8494"/>`)
    .join("\n  ");
  return tile({
    ground: "#a7adb8",
    groundDark: "#8f96a3",
    soil: "#5d5a58",
    soilDark: "#4c4947",
    details: `${rocks}\n  ${peaks}`,
  });
}

function desert() {
  const dunes = [];
  for (let i = 0; i < 7; i++) {
    const y = 170 + i * 120;
    dunes.push(
      `<path d="M-20 ${y} Q 256 ${y - 46} 512 ${y} T 1044 ${y}" fill="none" stroke="#d6b673" stroke-width="12" stroke-linecap="round" opacity="0.7"/>`,
    );
  }
  const calmMask = `<ellipse cx="512" cy="512" rx="200" ry="176" fill="#ecd59c"/>
  <ellipse cx="246" cy="666" rx="84" ry="72" fill="#ecd59c"/>`;
  const cacti = scatter(61, 5, { minGap: 200, pad: 60 })
    .map(({ x, y }) => `${shadow(x, y, 26)}
  <rect x="${f(x - 10)}" y="${f(y - 76)}" width="20" height="78" rx="10" fill="#6f9a4a"/>
  <path d="M${f(x - 10)} ${f(y - 34)} h-14 a6 6 0 0 1 -6 -6 v-20" fill="none" stroke="#6f9a4a" stroke-width="12" stroke-linecap="round"/>
  <path d="M${f(x + 10)} ${f(y - 46)} h14 a6 6 0 0 0 6 -6 v-14" fill="none" stroke="#6f9a4a" stroke-width="12" stroke-linecap="round"/>`)
    .join("\n  ");
  const stones = scatter(62, 7, { minGap: 120, pad: 30 })
    .map(({ x, y }) => `<ellipse cx="${f(x)}" cy="${f(y - 8)}" rx="18" ry="11" fill="#c4a467"/>`)
    .join("\n  ");
  return tile({
    ground: "#ecd59c",
    groundDark: "#d8bd7d",
    soil: "#9b7a4a",
    soilDark: "#86673b",
    details: `${dunes.join("\n  ")}\n  ${calmMask}\n  ${stones}\n  ${cacti}`,
  });
}

function sea() {
  // Top-down, 1024 x 1024: calm water with a few wave dashes, seamless enough per hex.
  const waves = scatter(71, 16, { minGap: 150, pad: -200, inset: 60, top: 60 })
    .map(({ x, y }) => `<path d="M${f(x - 34)} ${f(y)} q17 -14 34 0 t34 0" fill="none" stroke="#7cc0e6" stroke-width="9" stroke-linecap="round" opacity="0.8"/>`)
    .join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#2f86bf"/>
  ${waves}
</svg>
`;
}

const tiles = { forest, pasture, fields, hills, mountains, desert, sea };
for (const [name, build] of Object.entries(tiles)) {
  writeFileSync(join(OUT, `${name}.svg`), build());
}
console.log(`wrote ${Object.keys(tiles).length} SVGs to ${OUT}`);
