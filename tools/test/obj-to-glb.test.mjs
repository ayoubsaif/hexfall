// Tests for tools/obj-to-glb.mjs (openspec change physics-dice-3d, task 1.3).
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getBounds } from "@gltf-transform/core";
import { describe, expect, it } from "vite-plus/test";
import {
  DIE_EDGE,
  FACE_MAP,
  buildMeshes,
  checkFaceMap,
  convertDie,
  countPips,
  parseMtl,
  parseObj,
} from "../obj-to-glb.mjs";
import { createIO } from "../stl-to-glb.mjs";

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs/art/sources/dice");
const objText = readFileSync(resolve(SOURCE, "Dice.obj"), "utf8");
const mtlText = readFileSync(resolve(SOURCE, "Dice.mtl"), "utf8");

describe("parsing", () => {
  it("reads quads with normals and materials", () => {
    const obj = parseObj("v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nvn 0 0 1\nusemtl A\nf 1//1 2//1 3//1 4//1\n");
    expect(obj.positions).toHaveLength(4);
    expect(obj.faces[0]).toEqual({
      material: "A",
      corners: [0, 1, 2, 3].map((v) => ({ v, n: 0 })),
    });
  });

  it("reads Kd and Ns from the MTL", () => {
    const mtl = parseMtl(mtlText);
    expect(mtl.Red.kd).toEqual([0.64, 0.017002, 0.019308]);
    expect(mtl.White.kd).toEqual([0.8, 0.8, 0.8]);
    expect(mtl.Red.ns).toBeCloseTo(96.08, 1);
  });
});

describe("face map", () => {
  it("counts 1–6 pips on the contract sides of the committed die", () => {
    const counts = countPips(parseObj(objText));
    expect(counts).toEqual({ "+y": 1, "+z": 2, "+x": 3, "-x": 4, "-z": 5, "-y": 6 });
    expect(() => checkFaceMap(counts)).not.toThrow();
  });

  it("fails and names the side when the source does not match (spec: Face map checked)", () => {
    const counts = { "+y": 2, "+z": 2, "+x": 3, "-x": 4, "-z": 5, "-y": 6 };
    expect(() => checkFaceMap(counts)).toThrow("side +y should show 1 pips but has 2");
  });

  it("rejects a tampered source whose +Y pip is moved to -Y", async () => {
    // Mirror every vertex on Y: the 1 lands on -Y and the 6 on +Y.
    const mirrored = objText.replace(/^v (\S+) (\S+) (\S+)$/gm, (_l, x, y, z) => `v ${x} ${-y} ${z}`);
    await expect(convertDie(mirrored, mtlText)).rejects.toThrow(/side \+y/);
  });
});

async function readGlb(bytes) {
  const doc = await createIO().readBinary(bytes);
  return doc.getRoot();
}

describe("committed die source (spec: Converted die follows the contract)", () => {
  it("is centered with a 0.30 edge and keeps both materials", async () => {
    const root = await readGlb(await convertDie(objText, mtlText));
    const { min, max } = getBounds(root.getDefaultScene() ?? root.listScenes()[0]);
    for (let a = 0; a < 3; a++) {
      expect(Math.abs((min[a] + max[a]) / 2)).toBeLessThan(1e-3);
      expect(Math.abs(max[a] - min[a] - DIE_EDGE) / DIE_EDGE).toBeLessThan(0.01);
    }
    expect(
      root
        .listMaterials()
        .map((m) => m.getName())
        .sort(),
    ).toEqual(["Red", "White"]);
  });

  it("is deterministic, meshopt-compressed and inside the budget", async () => {
    const a = await convertDie(objText, mtlText);
    const b = await convertDie(objText, mtlText);
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
    const jsonLength = new DataView(a.buffer, a.byteOffset).getUint32(12, true);
    const json = JSON.parse(Buffer.from(a.subarray(20, 20 + jsonLength)).toString("utf8"));
    expect(json.extensionsUsed).toContain("EXT_meshopt_compression");
    expect(a.length).toBeLessThan(300 * 1024);
  });

  it("builds indexed geometry with unit normals pointing outward", () => {
    const meshes = buildMeshes(parseObj(objText));
    for (const m of meshes) {
      expect(m.index.length % 3).toBe(0);
      expect(m.normal.length).toBe(m.position.length);
      // On average a vertex normal points away from the center.
      let dot = 0;
      for (let i = 0; i < m.position.length; i += 3) {
        dot +=
          m.position[i] * m.normal[i] +
          m.position[i + 1] * m.normal[i + 1] +
          m.position[i + 2] * m.normal[i + 2];
      }
      expect(dot).toBeGreaterThan(0);
    }
  });
});

describe("client contract", () => {
  it("matches the client's DIE_FACE_AXES and DIE_EDGE (fallback and model show the same value)", async () => {
    const { DIE_FACE_AXES, DIE_EDGE: clientEdge } = await import(
      "../../apps/client/src/theme/die.ts"
    );
    expect(clientEdge).toBe(DIE_EDGE);
    for (const [side, value] of Object.entries(FACE_MAP)) {
      const axis = "xyz".indexOf(side[1]);
      const expected = [0, 0, 0];
      expected[axis] = side[0] === "+" ? 1 : -1;
      expect(DIE_FACE_AXES[value]).toEqual(expected);
    }
  });
});
