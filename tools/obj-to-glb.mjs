// OBJ → GLB converter for the die model (openspec change physics-dice-3d;
// specs/asset-theming "Reproducible die model conversion").
//
// Reads docs/art/sources/dice/Dice.obj + Dice.mtl, checks which side carries which value by
// counting pips, centers the die on the origin, scales its edge to 0.30 units, and writes a
// meshopt-compressed GLB into the diorama theme with two materials: "Body" (the source's
// "Red") and "Pips" (the source's "White"), colored like the client's die (white body, black
// pips; apps/client/src/theme/die.ts). Deterministic: same input, same bytes.
//
// Usage: pnpm run models:dice   (or: node tools/obj-to-glb.mjs)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Logger } from "@gltf-transform/core";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { DIE_BODY_COLOR, DIE_PIP_COLOR } from "../apps/client/src/theme/die.ts";
import { createIO } from "./stl-to-glb.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "docs", "art", "sources", "dice");
const OUT_FILE = join(ROOT, "apps", "client", "public", "themes", "diorama", "models", "die.glb");

/** Edge length of the converted die, in hex-circumradius units. */
export const DIE_EDGE = 0.3;

/** Material holding the pips; the other one is the body. */
export const PIP_MATERIAL = "White";

/**
 * The die's value on each local side (the client's DIE_FACE_AXES must match):
 * +Y=1, +Z=2, +X=3, −X=4, −Z=5, −Y=6.
 */
export const FACE_MAP = { "+y": 1, "+z": 2, "+x": 3, "-x": 4, "-z": 5, "-y": 6 };

/** Parses the subset of OBJ the die uses: v, vn, usemtl and polygon faces (v//vn or v/vt/vn). */
export function parseObj(text) {
  const positions = [];
  const normals = [];
  const faces = [];
  let material = null;
  for (const raw of text.split("\n")) {
    const parts = raw.trim().split(/\s+/);
    switch (parts[0]) {
      case "v":
        positions.push(parts.slice(1, 4).map(Number));
        break;
      case "vn":
        normals.push(parts.slice(1, 4).map(Number));
        break;
      case "usemtl":
        material = parts[1];
        break;
      case "f": {
        if (material === null) throw new Error("OBJ: face before any usemtl");
        const corners = parts.slice(1).map((c) => {
          const [v, , n] = c.split("/");
          const vi = Number.parseInt(v, 10);
          const ni = n ? Number.parseInt(n, 10) : Number.NaN;
          return { v: vi - 1, n: Number.isNaN(ni) ? -1 : ni - 1 };
        });
        if (corners.length < 3) throw new Error("OBJ: face with fewer than 3 corners");
        faces.push({ material, corners });
        break;
      }
      default:
        break;
    }
  }
  return { positions, normals, faces };
}

/** Parses Kd and Ns per material from an MTL file. */
export function parseMtl(text) {
  const out = {};
  let current = null;
  for (const raw of text.split("\n")) {
    const parts = raw.trim().split(/\s+/);
    if (parts[0] === "newmtl") current = out[parts[1]] = { kd: [0.8, 0.8, 0.8], ns: 50 };
    else if (current && parts[0] === "Kd") current.kd = parts.slice(1, 4).map(Number);
    else if (current && parts[0] === "Ns") current.ns = Number(parts[1]);
  }
  return out;
}

function sideOf(p) {
  const a = p.map(Math.abs);
  const i = a.indexOf(Math.max(...a));
  return (p[i] >= 0 ? "+" : "-") + "xyz"[i];
}

/**
 * Counts pips on each side: connected groups of pip-material faces (sharing a vertex),
 * assigned to the side their center lies on.
 */
export function countPips(obj, pipMaterial = PIP_MATERIAL) {
  const pipFaces = obj.faces.filter((f) => f.material === pipMaterial);
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  for (const f of pipFaces) for (const c of f.corners) if (!parent.has(c.v)) parent.set(c.v, c.v);
  for (const f of pipFaces) {
    const root = find(f.corners[0].v);
    for (const c of f.corners) parent.set(find(c.v), root);
  }
  const groups = new Map();
  for (const f of pipFaces) {
    const root = find(f.corners[0].v);
    let g = groups.get(root);
    if (!g) groups.set(root, (g = { sum: [0, 0, 0], n: 0 }));
    for (const c of f.corners) {
      const p = obj.positions[c.v];
      g.sum[0] += p[0];
      g.sum[1] += p[1];
      g.sum[2] += p[2];
      g.n++;
    }
  }
  const counts = { "+x": 0, "-x": 0, "+y": 0, "-y": 0, "+z": 0, "-z": 0 };
  for (const g of groups.values()) counts[sideOf(g.sum.map((s) => s / g.n))]++;
  return counts;
}

/** Throws unless every side shows the pip count FACE_MAP gives it. */
export function checkFaceMap(counts) {
  for (const [side, value] of Object.entries(FACE_MAP)) {
    if (counts[side] !== value) {
      throw new Error(`face map: side ${side} should show ${value} pips but has ${counts[side]}`);
    }
  }
}

/**
 * Builds one indexed mesh per material, centered on the origin and scaled so the largest
 * extent equals `edge`. Keeps the source normals; flips winding if the mesh faces inward.
 */
export function buildMeshes(obj, edge = DIE_EDGE) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of obj.positions) {
    for (let a = 0; a < 3; a++) {
      if (p[a] < min[a]) min[a] = p[a];
      if (p[a] > max[a]) max[a] = p[a];
    }
  }
  const center = [0, 1, 2].map((a) => (min[a] + max[a]) / 2);
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  if (!(extent > 0)) throw new Error("buildMeshes: degenerate mesh (zero extent)");
  const k = edge / extent;
  const place = (p) => [0, 1, 2].map((a) => (p[a] - center[a]) * k);

  // Fan-triangulate and measure winding over the whole mesh.
  const tris = [];
  let volume = 0;
  for (const f of obj.faces) {
    for (let i = 1; i + 1 < f.corners.length; i++) {
      const t = [f.corners[0], f.corners[i], f.corners[i + 1]];
      const [a, b, c] = t.map((x) => place(obj.positions[x.v]));
      volume +=
        a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0]);
      tris.push({ material: f.material, t });
    }
  }
  const flip = volume < 0;

  const materials = [...new Set(obj.faces.map((f) => f.material))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return materials.map((name) => {
    const position = [];
    const normal = [];
    const index = [];
    const ids = new Map();
    for (const tri of tris) {
      if (tri.material !== name) continue;
      const corners = flip ? [tri.t[0], tri.t[2], tri.t[1]] : tri.t;
      for (const c of corners) {
        const key = `${c.v}/${c.n}`;
        let id = ids.get(key);
        if (id === undefined) {
          id = position.length / 3;
          ids.set(key, id);
          position.push(...place(obj.positions[c.v]));
          const n = c.n >= 0 ? obj.normals[c.n] : [0, 1, 0];
          const len = Math.hypot(n[0], n[1], n[2]) || 1;
          normal.push(n[0] / len, n[1] / len, n[2] / len);
        }
        index.push(id);
      }
    }
    const count = position.length / 3;
    return {
      material: name,
      position: Float32Array.from(position),
      normal: Float32Array.from(normal),
      index: count < 65536 ? Uint16Array.from(index) : Uint32Array.from(index),
    };
  });
}

/** Output material for each source material, with the client's die colors. */
export const OUTPUT_MATERIALS = {
  Red: { name: "Body", color: DIE_BODY_COLOR },
  White: { name: "Pips", color: DIE_PIP_COLOR },
};

/** "#rrggbb" (sRGB) to linear RGB, as glTF base colors are linear. */
export function srgbHexToLinear(hex) {
  return [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

/** Blender's specular exponent (0–1000) as an approximate PBR roughness. */
export function roughnessFromNs(ns) {
  return Math.min(1, Math.max(0.05, Math.sqrt(2 / (ns + 2))));
}

/** Writes the meshes as one node with one primitive per material. Resolves to GLB bytes. */
export async function writeDieGlb(meshes, mtl) {
  await MeshoptEncoder.ready;
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  doc.getRoot().getAsset().generator = "hexfall tools/obj-to-glb.mjs";
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh("die");
  for (const m of meshes) {
    const info = mtl[m.material] ?? { kd: [0.8, 0.8, 0.8], ns: 50 };
    const out = OUTPUT_MATERIALS[m.material];
    const material = doc
      .createMaterial(out?.name ?? m.material)
      .setBaseColorFactor([...(out ? srgbHexToLinear(out.color) : info.kd), 1])
      .setRoughnessFactor(roughnessFromNs(info.ns))
      .setMetallicFactor(0);
    const prim = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc.createAccessor().setType("VEC3").setArray(m.position).setBuffer(buffer),
      )
      .setAttribute(
        "NORMAL",
        doc.createAccessor().setType("VEC3").setArray(m.normal).setBuffer(buffer),
      )
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(m.index).setBuffer(buffer))
      .setMaterial(material);
    mesh.addPrimitive(prim);
  }
  const node = doc.createNode("die").setMesh(mesh);
  doc.createScene("die").addChild(node);
  doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  return createIO().writeBinary(doc);
}

/** Full pipeline from the OBJ and MTL texts. */
export async function convertDie(objText, mtlText) {
  const obj = parseObj(objText);
  checkFaceMap(countPips(obj));
  return writeDieGlb(buildMeshes(obj), parseMtl(mtlText));
}

async function main() {
  const glb = await convertDie(
    readFileSync(join(SOURCE_DIR, "Dice.obj"), "utf8"),
    readFileSync(join(SOURCE_DIR, "Dice.mtl"), "utf8"),
  );
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, glb);
  console.log(`obj-to-glb: die → ${OUT_FILE} (${(glb.length / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`obj-to-glb: ${error.message}`);
    process.exit(1);
  });
}
