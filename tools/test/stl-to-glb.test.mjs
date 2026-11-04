// Tests for tools/stl-to-glb.mjs (openspec change stl-piece-models, tasks 2.2–2.5).
import { getBounds } from "@gltf-transform/core";
import { describe, expect, it } from "vite-plus/test";
import {
  PIECES,
  bounds,
  convertGeometry,
  convertPiece,
  createIO,
  fixWinding,
  normalize,
  orient,
  parseBinaryStl,
  signedVolume,
  weldWithCreases,
} from "../stl-to-glb.mjs";

/** Builds a binary STL from triangles given as [[x,y,z],[x,y,z],[x,y,z]]. */
function stl(triangles) {
  const buf = Buffer.alloc(84 + triangles.length * 50);
  buf.writeUInt32LE(triangles.length, 80);
  triangles.forEach((tri, t) => {
    const base = 84 + t * 50 + 12;
    tri.flat().forEach((v, i) => buf.writeFloatLE(v, base + i * 4));
  });
  return buf;
}

/** Outward-wound unit cube [0,1]^3 as 12 triangles. */
function cubeTriangles() {
  const v = (x, y, z) => [x, y, z];
  const quads = [
    [v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)], // z=0, normal -z
    [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)], // z=1, normal +z
    [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)], // y=0, normal -y
    [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)], // y=1, normal +y
    [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)], // x=0, normal -x
    [v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)], // x=1, normal +x
  ];
  return quads.flatMap(([a, b, c, d]) => [
    [a, b, c],
    [a, c, d],
  ]);
}

describe("parseBinaryStl", () => {
  it("parses a two-triangle binary STL", () => {
    const tris = [
      [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ],
      [
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ];
    const p = parseBinaryStl(stl(tris));
    expect(p.length).toBe(18);
    expect(Array.from(p.subarray(9, 12))).toEqual([1, 0, 0]);
  });

  it("rejects a truncated buffer", () => {
    const buf = stl(cubeTriangles()).subarray(0, 300);
    expect(() => parseBinaryStl(buf)).toThrow(/truncated/);
  });

  it("rejects ASCII STL by name", () => {
    const text = "solid cube\n facet normal 0 0 1\n  outer loop\n".padEnd(200, " ");
    expect(() => parseBinaryStl(Buffer.from(text, "ascii"))).toThrow(/ASCII/);
  });
});

describe("geometry pipeline", () => {
  it("welds a cube into 24 creased vertices with outward normals", () => {
    const mesh = weldWithCreases(parseBinaryStl(stl(cubeTriangles())));
    expect(mesh.position.length / 3).toBe(24);
    expect(mesh.index.length).toBe(36);
    for (let i = 0; i < mesh.position.length; i += 3) {
      // Outward: the normal points away from the cube center (0.5, 0.5, 0.5).
      const d =
        (mesh.position[i] - 0.5) * mesh.normal[i] +
        (mesh.position[i + 1] - 0.5) * mesh.normal[i + 1] +
        (mesh.position[i + 2] - 0.5) * mesh.normal[i + 2];
      expect(d).toBeGreaterThan(0);
    }
  });

  it("fixes inward winding", () => {
    const inward = cubeTriangles().map(([a, b, c]) => [a, c, b]);
    const p = parseBinaryStl(stl(inward));
    expect(signedVolume(p)).toBeLessThan(0);
    expect(signedVolume(fixWinding(p))).toBeCloseTo(1, 5);
  });

  it("turns Z-up input into Y-up", () => {
    // A tall box on Z: 1 x 1 x 3.
    const tall = cubeTriangles().map((tri) => tri.map(([x, y, z]) => [x, y, z * 3]));
    const { min, max } = bounds(orient(parseBinaryStl(stl(tall)), "z"));
    expect(max[1] - min[1]).toBeCloseTo(3, 5);
    expect(max[2] - min[2]).toBeCloseTo(1, 5);
  });

  it("normalizes to the contract: centered, base at y=0, fitted size", () => {
    const box = cubeTriangles().map((tri) => tri.map(([x, y, z]) => [x * 4 + 10, y - 7, z * 2]));
    const p = normalize(parseBinaryStl(stl(box)), { mode: "x", size: 0.72 });
    const { min, max } = bounds(p);
    expect(min[1]).toBeCloseTo(0, 6);
    expect(max[0] - min[0]).toBeCloseTo(0.72, 5);
    expect((min[0] + max[0]) / 2).toBeCloseTo(0, 6);
    expect((min[2] + max[2]) / 2).toBeCloseTo(0, 6);
  });
});

/** Bounding box of a GLB's default scene, after meshopt decoding and quantization. */
async function glbBounds(bytes) {
  const doc = await createIO().readBinary(bytes);
  return getBounds(doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]);
}

describe("committed piece sources", () => {
  const road = PIECES.find((p) => p.name === "road");

  it("converts the road to the contract (spec: Converted road follows the contract)", async () => {
    const { min, max } = await glbBounds(await convertPiece(road));
    expect(Math.abs(min[1])).toBeLessThan(1e-4);
    expect(Math.abs((min[0] + max[0]) / 2)).toBeLessThan(1e-3);
    expect(Math.abs((min[2] + max[2]) / 2)).toBeLessThan(1e-3);
    expect(Math.abs(max[0] - min[0] - 0.72) / 0.72).toBeLessThan(0.01);
  });

  it.each(PIECES.filter((p) => p.fit.mode === "footprint").map((p) => [p.name, p]))(
    "fits the %s footprint to its fallback size",
    async (_name, piece) => {
      const { min, max } = await glbBounds(await convertPiece(piece));
      const side = Math.max(max[0] - min[0], max[2] - min[2]);
      expect(Math.abs(side - piece.fit.size) / piece.fit.size).toBeLessThan(0.01);
      expect(Math.abs(min[1])).toBeLessThan(1e-4);
    },
  );

  it("is deterministic and meshopt-compressed (spec: Conversion is deterministic)", async () => {
    for (const piece of PIECES) {
      const a = await convertPiece(piece);
      const b = await convertPiece(piece);
      expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
      const jsonLength = new DataView(a.buffer, a.byteOffset).getUint32(12, true);
      const json = JSON.parse(Buffer.from(a.subarray(20, 20 + jsonLength)).toString("utf8"));
      expect(json.extensionsUsed).toContain("EXT_meshopt_compression");
      expect(a.length).toBeLessThan(300 * 1024);
    }
  });

  it("produces indexed geometry with normals", () => {
    // convertGeometry is the pre-compression mesh; check it directly.
    const mesh = convertGeometry(
      Buffer.from(stlOfCube()), // small sanity input
      { upAxis: "y", yawDeg: 0, fit: { mode: "footprint", size: 0.2 } },
    );
    expect(mesh.index.length % 3).toBe(0);
    expect(mesh.normal.length).toBe(mesh.position.length);
  });
});

function stlOfCube() {
  return stl(cubeTriangles());
}
