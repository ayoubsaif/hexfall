// Builds one starter template per asset key (docs/art/templates/README.md).
// Every size below is read from the client's real geometry, so art painted on these
// templates lines up in game:
//   tiles/sea  -> docs/art/tile-*-template.svg (pointy-top hex, 1 unit = circumradius)
//   token      -> apps/client/src/theme/flat.tsx TOKEN_RADIUS 0.3, label 0.5 (NumberToken.tsx)
//   harbor.*   -> flat.tsx HARBOR_BADGE_SIZE 0.42, corner 0.08, label 0.4 (HarborMarker.tsx)
//   piece.*    -> apps/client/src/theme/fallbacks/pieces.tsx (procedural fallback shapes)
// Usage: node docs/art/templates/build.mjs && pnpm exec vp fmt docs/art/templates
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = join(HERE, "..");
const f = (n) => Number(n.toFixed(1));

function write(rel, text) {
  const path = join(HERE, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// ---- Tiles and sea: stamp the shared hex templates once per key.

const TILES = {
  "tile.forest": { file: "forest", color: "#3f6e3a", label: "forest (lumber)" },
  "tile.pasture": { file: "pasture", color: "#8fc06a", label: "pasture (wool)" },
  "tile.fields": { file: "fields", color: "#d9b44a", label: "fields (grain)" },
  "tile.hills": { file: "hills", color: "#b8653a", label: "hills (brick)" },
  "tile.mountains": { file: "mountains", color: "#7d8088", label: "mountains (ore)" },
  "tile.desert": { file: "desert", color: "#e3cf9a", label: "desert (no token)" },
  sea: { file: "sea", color: "#3d7fb0", label: "sea (frame around the island)" },
};

function stampTile(template, key, { color, label }) {
  return template
    .replace(/(id="(?:hex|top-face)"[^>]*fill=")#[0-9a-f]{6}/i, `$1${color}`)
    .replace("<svg ", `<!-- Asset key: ${key} - ${label} -->\n<svg `);
}

const topTemplate = readFileSync(join(ART, "tile-top-template.svg"), "utf8");
const isoTemplate = readFileSync(join(ART, "tile-isometric-template.svg"), "utf8");
for (const [key, t] of Object.entries(TILES)) {
  write(`tiles-top/${t.file}.svg`, stampTile(topTemplate, key, t));
  // The sea is always a top-down image, even when terrains are isometric.
  if (key !== "sea") write(`tiles-isometric/${t.file}.svg`, stampTile(isoTemplate, key, t));
}

// ---- Number token: a 1024 px square mapped onto the 0.6-unit disc.

const TOKEN_PX = 1024 / 0.6; // px per unit
const tokLabel = 0.5 * TOKEN_PX; // label quad side in px
const tokOff = (1024 - tokLabel) / 2;
const outlineTok = 0.018 * TOKEN_PX;
const numY = tokOff + 0.44 * tokLabel;
const numSize = 0.46 * tokLabel;
const pipY = tokOff + 0.76 * tokLabel;
const pipR = 0.035 * tokLabel;
const pipGap = 0.1 * tokLabel;

write(
  "token.svg",
  `<?xml version="1.0" encoding="UTF-8"?>
<!-- Asset key: token - number token disc (radius 0.3 hex), 1024 x 1024 px.
     The game draws the number and the probability pips on top; paint only the disc
     background. Keep the blue areas calm. Pixels outside the circle are never shown.
     Delete the "guides" layer before export (PNG/WebP, sRGB, <= 400 KB).
     Theme entry: "token": { "image": "token.webp" } -->
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g id="art">
    <circle id="disc" cx="512" cy="512" r="512" fill="#f1e6c8"/>
  </g>
  <g id="guides" fill="none" stroke-width="3" font-family="sans-serif" font-size="22">
    <circle cx="512" cy="512" r="512" stroke="#ff2d55"/>
    <circle cx="512" cy="512" r="${f(512 - outlineTok)}" stroke="#ff9500" stroke-dasharray="10 6"/>
    <text x="512" y="${f(outlineTok + 70)}" fill="#ff9500" text-anchor="middle">outline ring drawn here</text>
    <rect x="${f(512 - numSize * 0.6)}" y="${f(numY - numSize / 2)}" width="${f(numSize * 1.2)}" height="${f(numSize)}" stroke="#007aff" stroke-dasharray="12 8"/>
    <text x="512" y="${f(numY - numSize / 2 - 12)}" fill="#007aff" text-anchor="middle">number (2-12)</text>
    <rect x="${f(512 - 2 * pipGap - pipR - 8)}" y="${f(pipY - pipR - 8)}" width="${f(4 * pipGap + 2 * pipR + 16)}" height="${f(2 * pipR + 16)}" stroke="#007aff" stroke-dasharray="12 8"/>
    <text x="512" y="${f(pipY + pipR + 44)}" fill="#007aff" text-anchor="middle">pips (1-5 dots)</text>
    <text x="512" y="190" fill="#ff2d55" text-anchor="middle">top = away from the player</text>
  </g>
</svg>
`,
);

// ---- Harbor badges: a 1024 px square mapped onto the 0.42-unit rounded badge.

const BADGE_PX = 1024 / 0.42;
const corner = 0.08 * BADGE_PX;
const outlineBadge = 0.018 * BADGE_PX;
const hbLabel = 0.4 * BADGE_PX;
const hbOff = (1024 - hbLabel) / 2;

const HARBORS = {
  "harbor.generic": { file: "generic", color: "#f4efe1", rate: "3:1", resource: null },
  "harbor.brick": { file: "brick", color: "#b4532f", rate: "2:1", resource: "brick" },
  "harbor.grain": { file: "grain", color: "#e0b83c", rate: "2:1", resource: "grain" },
  "harbor.lumber": { file: "lumber", color: "#2f6b34", rate: "2:1", resource: "lumber" },
  "harbor.ore": { file: "ore", color: "#6f747c", rate: "2:1", resource: "ore" },
  "harbor.wool": { file: "wool", color: "#a5d46a", rate: "2:1", resource: "wool" },
};

for (const [key, h] of Object.entries(HARBORS)) {
  const rateSize = 0.34 * hbLabel;
  const rateY = hbOff + (h.resource ? 0.38 : 0.5) * hbLabel;
  const resSize = 0.2 * hbLabel;
  const resY = hbOff + 0.7 * hbLabel;
  const resW = 0.92 * hbLabel;
  const resourceGuide = h.resource
    ? `
    <rect x="${f(512 - resW / 2)}" y="${f(resY - resSize / 2)}" width="${f(resW)}" height="${f(resSize)}" stroke="#007aff" stroke-dasharray="12 8"/>
    <text x="512" y="${f(resY + resSize / 2 + 30)}" fill="#007aff" text-anchor="middle">"${h.resource}" label</text>`
    : "";
  write(
    `harbors/${h.file}.svg`,
    `<?xml version="1.0" encoding="UTF-8"?>
<!-- Asset key: ${key} - ${h.rate}${h.resource ? ` ${h.resource}` : " generic"} harbor badge (0.42 hex wide), 1024 x 1024 px.
     The game draws the "${h.rate}"${h.resource ? ` and "${h.resource}"` : ""} text on top; keep the blue areas calm
     (an icon of the resource works well around them). Pixels outside the rounded square
     are never shown. Delete the "guides" layer before export (PNG/WebP, sRGB, <= 400 KB).
     Theme entry: "${key}": { "image": "harbors/${h.file}.webp" } -->
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g id="art">
    <rect id="badge" x="0" y="0" width="1024" height="1024" rx="${f(corner)}" fill="${h.color}"/>
  </g>
  <g id="guides" fill="none" stroke-width="3" font-family="sans-serif" font-size="26">
    <rect x="0" y="0" width="1024" height="1024" rx="${f(corner)}" stroke="#ff2d55"/>
    <rect x="${f(outlineBadge)}" y="${f(outlineBadge)}" width="${f(1024 - 2 * outlineBadge)}" height="${f(1024 - 2 * outlineBadge)}" rx="${f(corner - outlineBadge)}" stroke="#ff9500" stroke-dasharray="10 6"/>
    <rect x="${f(512 - rateSize * 0.95)}" y="${f(rateY - rateSize / 2)}" width="${f(rateSize * 1.9)}" height="${f(rateSize)}" stroke="#007aff" stroke-dasharray="12 8"/>
    <text x="512" y="${f(rateY - rateSize / 2 - 14)}" fill="#007aff" text-anchor="middle">"${h.rate}" label</text>${resourceGuide}
    <text x="512" y="${f(outlineBadge + 40)}" fill="#ff9500" text-anchor="middle">outline drawn inside the edge</text>
  </g>
</svg>
`,
  );
}

// ---- Pieces: glTF 2.0 size references built from the fallback shapes.
// Y-up, 1 unit = hex circumradius, origin at the base center, resting on y = 0.

/** Flat-shaded triangles -> {positions, normals}. */
function mesh() {
  const pos = [];
  const nor = [];
  const tri = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1;
    n = n.map((x) => x / len);
    for (const p of [a, b, c]) {
      pos.push(...p);
      nor.push(...n);
    }
  };
  const quad = (a, b, c, d) => {
    tri(a, b, c);
    tri(a, c, d);
  };
  return { pos, nor, tri, quad };
}

function box(m, [cx, cy, cz], [w, h, d]) {
  const x0 = cx - w / 2,
    x1 = cx + w / 2,
    y0 = cy - h / 2,
    y1 = cy + h / 2,
    z0 = cz - d / 2,
    z1 = cz + d / 2;
  m.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]); // top
  m.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]); // bottom
  m.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); // +z
  m.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]); // -z
  m.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); // +x
  m.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); // -x
}

/** Settlement-style house: box plus hip roof (pieces.tsx House). */
function house(m, [ox, oy, oz], w, d, h) {
  box(m, [ox, oy + h / 2, oz], [w, h, d]);
  const hx = 0.78 * w * Math.SQRT1_2;
  const hz = 0.78 * d * Math.SQRT1_2;
  const y = oy + h;
  const apex = [ox, y + 0.7 * h, oz];
  const c = [
    [ox - hx, y, oz - hz],
    [ox - hx, y, oz + hz],
    [ox + hx, y, oz + hz],
    [ox + hx, y, oz - hz],
  ];
  for (let i = 0; i < 4; i++) m.tri(c[i], c[(i + 1) % 4], apex);
  m.quad(c[3], c[2], c[1], c[0]);
}

/** 8-sided frustum from y0 to y1. */
function frustum(m, y0, y1, r0, r1, n = 8) {
  const ring = (y, r) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });
  const b = ring(y0, r0);
  const t = ring(y1, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.quad(b[j], b[i], t[i], t[j]);
    m.tri([0, y1, 0], t[j], t[i]);
    m.tri([0, y0, 0], b[i], b[j]);
  }
}

/** Double cone standing in for the robber's round head. */
function bicone(m, cy, r, n = 8) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p0 = [Math.cos(a0) * r, cy, Math.sin(a0) * r];
    const p1 = [Math.cos(a1) * r, cy, Math.sin(a1) * r];
    m.tri(p1, p0, [0, cy + r, 0]);
    m.tri(p0, p1, [0, cy - r, 0]);
  }
}

function gltf(name, material, color, build) {
  const m = mesh();
  build(m);
  const n = m.pos.length / 3;
  const bin = Buffer.alloc(n * 24);
  m.pos.forEach((v, i) => bin.writeFloatLE(v, i * 4));
  m.nor.forEach((v, i) => bin.writeFloatLE(v, n * 12 + i * 4));
  const min = [0, 1, 2].map((k) => Math.min(...m.pos.filter((_, i) => i % 3 === k)));
  const max = [0, 1, 2].map((k) => Math.max(...m.pos.filter((_, i) => i % 3 === k)));
  const doc = {
    asset: { version: "2.0", generator: "hexfall docs/art/templates/build.mjs" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, material: 0 }] }],
    materials: [
      {
        name: material,
        pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: 0.8 },
      },
    ],
    buffers: [
      {
        byteLength: bin.length,
        uri: `data:application/octet-stream;base64,${bin.toString("base64")}`,
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: n * 12, target: 34962 },
      { buffer: 0, byteOffset: n * 12, byteLength: n * 12, target: 34962 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: n, type: "VEC3", min, max },
      { bufferView: 1, componentType: 5126, count: n, type: "VEC3" },
    ],
  };
  write(`pieces/${name}.gltf`, `${JSON.stringify(doc, null, 2)}\n`);
  return { min, max };
}

const TINT = [0.85, 0.85, 0.85, 1];
const sizes = {
  road: gltf("road", "PlayerColor", TINT, (m) => box(m, [0, 0.05, 0], [0.72, 0.1, 0.11])),
  settlement: gltf("settlement", "PlayerColor", TINT, (m) => house(m, [0, 0, 0], 0.2, 0.18, 0.14)),
  city: gltf("city", "PlayerColor", TINT, (m) => {
    box(m, [0.05, 0.07, 0], [0.36, 0.14, 0.22]);
    house(m, [-0.08, 0.14, 0], 0.18, 0.2, 0.14);
  }),
  robber: gltf("robber", "Robber", [0.2, 0.2, 0.23, 1], (m) => {
    frustum(m, 0, 0.06, 0.13, 0.12);
    frustum(m, 0.06, 0.34, 0.1, 0.06);
    bicone(m, 0.4, 0.08);
  }),
};
for (const [k, { min, max }] of Object.entries(sizes)) {
  const dims = max.map((v, i) => (v - min[i]).toFixed(2)).join(" x ");
  console.log(`piece.${k}: ${dims} (x * y * z units)`);
}
console.log("templates written to docs/art/templates/");
