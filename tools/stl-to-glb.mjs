// STL → GLB converter for the diorama piece models (openspec change stl-piece-models;
// specs/asset-theming "Reproducible piece model conversion").
//
// Reads binary STLs from docs/art/sources/pieces/, orients and normalizes them to the
// model coordinate contract (Y-up, origin at base center, min Y = 0, 1 unit = hex
// circumradius), welds vertices with creased normals, and writes meshopt-compressed GLBs
// into the diorama theme. Deterministic: same input, same bytes.
//
// Usage: pnpm run models:pieces   (or: node tools/stl-to-glb.mjs)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Logger, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "docs", "art", "sources", "pieces");
const OUT_DIR = join(ROOT, "apps", "client", "public", "themes", "diorama", "models");

/**
 * Per-piece settings. The road matches its procedural fallback (0.72 long on X). The
 * settlement and city are fitted by their longest horizontal side, at 1.5x their
 * fallback size (0.30 and 0.50), which the owner asked for so the buildings read clearly.
 * upAxis: the source's up axis ("y" or "z"); yawDeg: turn about Y after orienting;
 * crossScale: optional extra factor on Y and Z only (thins a chunky road);
 * keep: share of triangles kept by simplification (the models are tiny on screen, so the
 * source's ~4-10k triangles are far more than the client needs).
 */
export const PIECES = [
  {
    name: "road",
    upAxis: "z",
    yawDeg: 0,
    fit: { mode: "x", size: 0.72 },
    crossScale: 0.5,
    keep: 0.2,
  },
  { name: "settlement", upAxis: "z", yawDeg: 0, fit: { mode: "footprint", size: 0.3 }, keep: 0.12 },
  { name: "city", upAxis: "z", yawDeg: 0, fit: { mode: "footprint", size: 0.5 }, keep: 0.1 },
];

export const CREASE_DEG = 40;

/** Parses a binary STL into a flat, unindexed Float32Array of triangle corners. */
export function parseBinaryStl(buf) {
  if (buf.length < 84) throw new Error("STL: file too short for a binary header");
  const count = buf.readUInt32LE(80);
  const expected = 84 + count * 50;
  if (buf.length !== expected) {
    const head = buf.subarray(0, 5).toString("ascii").toLowerCase();
    if (head === "solid" && buf.subarray(0, 512).toString("ascii").includes("facet")) {
      throw new Error("STL: ASCII STL is not supported; export as binary");
    }
    throw new Error(
      `STL: truncated or malformed (${buf.length} bytes, ${count} triangles need ${expected})`,
    );
  }
  const out = new Float32Array(count * 9);
  for (let t = 0; t < count; t++) {
    const base = 84 + t * 50 + 12; // skip the stored facet normal; we recompute it
    for (let i = 0; i < 9; i++) out[t * 9 + i] = buf.readFloatLE(base + i * 4);
  }
  return out;
}

/** Rotates source axes so Y is up, then yaws about Y. Returns a new array. */
export function orient(positions, upAxis = "y", yawDeg = 0) {
  const out = new Float32Array(positions.length);
  const yaw = (yawDeg * Math.PI) / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    let y = positions[i + 1];
    let z = positions[i + 2];
    if (upAxis === "z") [y, z] = [z, -y]; // -90° about X: +Z becomes +Y
    else if (upAxis !== "y") throw new Error(`orient: unsupported upAxis "${upAxis}"`);
    out[i] = c * x + s * z;
    out[i + 1] = y;
    out[i + 2] = -s * x + c * z;
  }
  return out;
}

export function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max };
}

/**
 * Centers on X/Z, puts min Y at 0 and scales uniformly to the fit target.
 * crossScale (default 1) multiplies Y and Z afterwards. Returns a new array.
 */
export function normalize(positions, fit, crossScale = 1) {
  const { min, max } = bounds(positions);
  const ext = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const ref = fit.mode === "x" ? ext[0] : Math.max(ext[0], ext[2]);
  if (!(ref > 0)) throw new Error("normalize: degenerate mesh (zero extent)");
  const k = fit.size / ref;
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = (positions[i] - cx) * k;
    out[i + 1] = (positions[i + 1] - min[1]) * k * crossScale;
    out[i + 2] = (positions[i + 2] - cz) * k * crossScale;
  }
  return out;
}

/** Signed volume of a closed triangle soup; negative means inward-facing winding. */
export function signedVolume(p) {
  let v = 0;
  for (let i = 0; i < p.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.subarray(i, i + 9);
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

/** Swaps the 2nd and 3rd corner of every triangle when the winding faces inward. */
export function fixWinding(positions) {
  if (signedVolume(positions) >= 0) return positions;
  const out = Float32Array.from(positions);
  for (let i = 0; i < out.length; i += 9) {
    for (let a = 0; a < 3; a++) {
      const t = out[i + 3 + a];
      out[i + 3 + a] = out[i + 6 + a];
      out[i + 6 + a] = t;
    }
  }
  return out;
}

/**
 * Welds coincident corners into indexed geometry with creased normals: a corner's normal
 * averages (area-weighted) the faces sharing its position whose normal is within
 * creaseDeg of its own face; sharper edges keep separate vertices.
 */
export function weldWithCreases(positions, creaseDeg = CREASE_DEG) {
  const { min, max } = bounds(positions);
  const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const q = 1e-5 * diag;
  const keyOf = (i) =>
    `${Math.round(positions[i] / q)},${Math.round(positions[i + 1] / q)},${Math.round(positions[i + 2] / q)}`;

  // Face normals (unnormalized cross product = 2 × area × unit normal); skip degenerates.
  const faces = [];
  for (let i = 0; i < positions.length; i += 9) {
    const ux = positions[i + 3] - positions[i];
    const uy = positions[i + 4] - positions[i + 1];
    const uz = positions[i + 5] - positions[i + 2];
    const vx = positions[i + 6] - positions[i];
    const vy = positions[i + 7] - positions[i + 1];
    const vz = positions[i + 8] - positions[i + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-12 * diag * diag) continue;
    const keys = [keyOf(i), keyOf(i + 3), keyOf(i + 6)];
    if (keys[0] === keys[1] || keys[1] === keys[2] || keys[0] === keys[2]) continue;
    faces.push({ at: i, n, unit: [n[0] / len, n[1] / len, n[2] / len], keys });
  }

  // Faces touching each welded position.
  const byKey = new Map();
  faces.forEach((f, fi) => {
    for (const k of f.keys) {
      let list = byKey.get(k);
      if (!list) byKey.set(k, (list = []));
      list.push(fi);
    }
  });

  const cosCrease = Math.cos((creaseDeg * Math.PI) / 180);
  const outPos = [];
  const outNrm = [];
  const index = [];
  const vertexIds = new Map();
  for (const f of faces) {
    for (let c = 0; c < 3; c++) {
      const k = f.keys[c];
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (const gi of byKey.get(k)) {
        const g = faces[gi];
        const dot = f.unit[0] * g.unit[0] + f.unit[1] * g.unit[1] + f.unit[2] * g.unit[2];
        if (dot >= cosCrease) {
          nx += g.n[0];
          ny += g.n[1];
          nz += g.n[2];
        }
      }
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const vk = `${k}|${Math.round(nx * 1e4)},${Math.round(ny * 1e4)},${Math.round(nz * 1e4)}`;
      let id = vertexIds.get(vk);
      if (id === undefined) {
        id = outPos.length / 3;
        vertexIds.set(vk, id);
        const at = f.at + c * 3;
        outPos.push(positions[at], positions[at + 1], positions[at + 2]);
        outNrm.push(nx, ny, nz);
      }
      index.push(id);
    }
  }
  const vertexCount = outPos.length / 3;
  return {
    position: Float32Array.from(outPos),
    normal: Float32Array.from(outNrm),
    index: vertexCount < 65536 ? Uint16Array.from(index) : Uint32Array.from(index),
  };
}

/** Full geometry pipeline for one piece: STL bytes → indexed, contract-conforming mesh. */
export function convertGeometry(stlBytes, piece) {
  const raw = parseBinaryStl(stlBytes);
  const oriented = orient(raw, piece.upAxis, piece.yawDeg);
  const fitted = normalize(oriented, piece.fit, piece.crossScale ?? 1);
  return weldWithCreases(fixWinding(fitted));
}

/**
 * Reduces a mesh to about `keep` of its triangles. Creased normals split vertices, which
 * pins the simplifier to those seams, so it works on a position-only weld and the normals are
 * rebuilt afterwards with `weldWithCreases`.
 */
export async function simplifyMesh(mesh, keep) {
  if (keep >= 1) return mesh;
  await MeshoptSimplifier.ready;
  const ids = new Map();
  const pos = [];
  const index = new Uint32Array(mesh.index.length);
  mesh.index.forEach((v, i) => {
    const x = mesh.position[v * 3];
    const y = mesh.position[v * 3 + 1];
    const z = mesh.position[v * 3 + 2];
    const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
      pos.push(x, y, z);
    }
    index[i] = id;
  });
  const target = Math.max(3, Math.floor((index.length * keep) / 3) * 3);
  const [slim] = MeshoptSimplifier.simplify(index, new Float32Array(pos), 3, target, 0.5, []);
  console.log(`stl-to-glb: simplified ${index.length / 3} → ${slim.length / 3} triangles`);
  const corners = new Float32Array(slim.length * 3);
  slim.forEach((v, i) => {
    corners[i * 3] = pos[v * 3];
    corners[i * 3 + 1] = pos[v * 3 + 1];
    corners[i * 3 + 2] = pos[v * 3 + 2];
  });
  return weldWithCreases(corners);
}

/** Builds and compresses a GLB from an indexed mesh. Resolves to the GLB bytes. */
export async function writeGlb(mesh, name) {
  await MeshoptEncoder.ready;
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  doc.getRoot().getAsset().generator = "hexfall tools/stl-to-glb.mjs";
  const buffer = doc.createBuffer();
  const position = doc.createAccessor().setType("VEC3").setArray(mesh.position).setBuffer(buffer);
  const normal = doc.createAccessor().setType("VEC3").setArray(mesh.normal).setBuffer(buffer);
  const indices = doc.createAccessor().setType("SCALAR").setArray(mesh.index).setBuffer(buffer);
  // One plain material, deliberately not named "PlayerColor": the whole piece is tinted.
  const material = doc
    .createMaterial("Piece")
    .setBaseColorFactor([1, 1, 1, 1])
    .setRoughnessFactor(0.6)
    .setMetallicFactor(0);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setAttribute("NORMAL", normal)
    .setIndices(indices)
    .setMaterial(material);
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
  doc.createScene(name).addChild(node);
  doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);

  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  return createIO().writeBinary(doc);
}

/** NodeIO that can read and write the meshopt + quantization extensions. */
export function createIO() {
  return new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
}

export async function convertPiece(piece, sourceDir = SOURCE_DIR) {
  const full = convertGeometry(readFileSync(join(sourceDir, `${piece.name}.stl`)), piece);
  return writeGlb(await simplifyMesh(full, piece.keep ?? 1), piece.name);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const piece of PIECES) {
    const glb = await convertPiece(piece);
    // (triangle counts are logged by simplifyMesh)
    const out = join(OUT_DIR, `${piece.name}.glb`);
    writeFileSync(out, glb);
    console.log(`stl-to-glb: ${piece.name} → ${out} (${(glb.length / 1024).toFixed(1)} KB)`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`stl-to-glb: ${error.message}`);
    process.exit(1);
  });
}
