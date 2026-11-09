// Procedural coast kit (`prop.boulder|cliff|wall|tree|bush`, plus the pasture `prop.sheep` and `prop.camp` and the forest `prop.woods`, and the mountain `prop.peak` and `prop.ore`), used when the theme has no GLB for
// a key. Each key has a few variants; each variant is a list of parts (geometry + material),
// the same shape the themed GLB variants take, so the coast renders both with one instanced
// mesh per part. Origin at the base centre, resting on y=0; heights stay below a city.
import { useMemo } from "react";
import {
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  BoxGeometry,
  type Material,
  MeshStandardMaterial,
} from "three";
import type { AssetKey } from "../keys.ts";

export const COAST_KEYS = [
  "prop.boulder",
  "prop.cliff",
  "prop.wall",
  "prop.tree",
  "prop.bush",
  "prop.sheep",
  "prop.camp",
  "prop.woods",
  "prop.peak",
  "prop.ore",
] as const satisfies readonly AssetKey[];
export type CoastKey = (typeof COAST_KEYS)[number];

export interface PropPart {
  geometry: BufferGeometry;
  material: Material | Material[];
}
export type PropVariant = readonly PropPart[];

const mat = (color: string) =>
  new MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });

/** Lumpy rock: a squashed icosahedron with a deterministic bump per vertex, base at y=0. */
function rock(radius: number, squash: number, seed: number, detail = 1): BufferGeometry {
  const g = new IcosahedronGeometry(radius, detail);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const k = 1 + 0.18 * Math.sin(x * 37 + seed) * Math.cos(z * 29 - y * 17 + seed * 2);
    p.setXYZ(i, x * k, Math.max(y * k * squash, -radius * 0.2), z * k);
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y, 0);
  return g;
}

function lifted<T extends BufferGeometry>(g: T, y: number): T {
  g.translate(0, y, 0);
  return g;
}

function build(): Record<CoastKey, PropVariant[]> {
  const stone = mat("#8d857a");
  const dark = mat("#6b655d");
  const bark = mat("#5a3f2b");
  const pine = mat("#2f5a32");
  const leaf = mat("#4f7a34");
  const wool = mat("#eee8d8");
  const face = mat("#3d332c");
  const plaster = mat("#e2d5b8");
  const thatch = mat("#cfa752");
  const wood = mat("#8a6643");
  const cap = mat("#b8432f");
  return {
    "prop.boulder": [
      [{ geometry: rock(0.1, 0.6, 1), material: stone }],
      [{ geometry: rock(0.075, 0.8, 2), material: stone }],
      [{ geometry: rock(0.13, 0.5, 3), material: stone }],
    ],
    "prop.cliff": [
      [
        {
          geometry: lifted(new DodecahedronGeometry(0.08, 0).scale(1, 1.4, 1), 0.1),
          material: dark,
        },
      ],
      [
        {
          geometry: lifted(new DodecahedronGeometry(0.1, 0).scale(1, 1.2, 0.9), 0.11),
          material: dark,
        },
      ],
    ],
    "prop.wall": [
      [{ geometry: lifted(new BoxGeometry(0.3, 0.065, 0.05), 0.0325), material: stone }],
      [{ geometry: rock(0.04, 0.9, 4, 0), material: stone }],
    ],
    "prop.tree": [
      [
        { geometry: lifted(new CylinderGeometry(0.01, 0.013, 0.06, 6), 0.03), material: bark },
        { geometry: lifted(new ConeGeometry(0.07, 0.22, 7), 0.16), material: pine },
      ],
    ],
    "prop.bush": [[{ geometry: rock(0.05, 0.75, 5), material: leaf }]],
    // A wool body on four dark legs with a dark head, facing +X (like sheep.glb).
    "prop.sheep": [
      [
        {
          geometry: lifted(new IcosahedronGeometry(0.03, 1).scale(1.6, 1, 1.05), 0.044),
          material: wool,
        },
        {
          geometry: lifted(new BoxGeometry(0.026, 0.02, 0.018), 0.058).translate(0.05, 0, 0),
          material: face,
        },
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => ({
            geometry: lifted(new CylinderGeometry(0.0035, 0.0035, 0.024, 5), 0.012).translate(
              sx * 0.021,
              0,
              sz * 0.0105,
            ),
            material: face,
          })),
        ),
      ],
    ],
    // Camp kit, in the order of camp.glb: hut (door on +X), fence segment, trough, hay pile.
    "prop.camp": [
      [
        { geometry: lifted(new BoxGeometry(0.058, 0.032, 0.082), 0.016), material: plaster },
        {
          geometry: lifted(
            new ConeGeometry(0.062, 0.05, 4).rotateY(Math.PI / 4).scale(0.9, 1, 1.35),
            0.057,
          ),
          material: thatch,
        },
      ],
      [
        { geometry: lifted(new BoxGeometry(0.16, 0.006, 0.005), 0.014), material: wood },
        { geometry: lifted(new BoxGeometry(0.16, 0.006, 0.005), 0.029), material: wood },
        ...[-0.08, 0, 0.08].map((x) => ({
          geometry: lifted(new BoxGeometry(0.0075, 0.04, 0.0075), 0.02).translate(x, 0, 0),
          material: wood,
        })),
      ],
      [{ geometry: lifted(new BoxGeometry(0.06, 0.014, 0.022), 0.017), material: wood }],
      [{ geometry: rock(0.026, 0.8, 6), material: thatch }],
    ],
    // Forest kit, in the order of woods.glb: fallen log (along X), stump, fern,
    // woodpile (logs along X), mushrooms.
    "prop.woods": [
      [
        {
          geometry: lifted(new CylinderGeometry(0.009, 0.01, 0.11, 7).rotateZ(Math.PI / 2), 0.009),
          material: bark,
        },
      ],
      [{ geometry: lifted(new CylinderGeometry(0.016, 0.019, 0.022, 8), 0.011), material: bark }],
      [{ geometry: lifted(new ConeGeometry(0.045, 0.028, 7), 0.014), material: leaf }],
      // Woodpile: cut logs stacked 3-2-1.
      [3, 2, 1].flatMap((n, row) =>
        Array.from({ length: n }, (_, i) => ({
          geometry: lifted(
            new CylinderGeometry(0.0085, 0.0085, 0.065, 7).rotateZ(Math.PI / 2),
            0.0085 + row * 0.015,
          ).translate(0, 0, (i - (n - 1) / 2) * 0.0175),
          material: bark,
        })),
      ),
      [
        {
          geometry: lifted(new CylinderGeometry(0.002, 0.002, 0.014, 5), 0.007),
          material: plaster,
        },
        { geometry: lifted(new ConeGeometry(0.0065, 0.006, 7), 0.016), material: cap },
      ],
    ],
    // Mountain peaks (in the order of peak.glb, footprint radius 0.2/0.17/0.19/0.15, then the two big centre mountains) and ore rocks.
    "prop.peak": [0.2, 0.17, 0.19, 0.15, 0.25, 0.25].map((r, i) => [
      {
        geometry: lifted(new ConeGeometry(r, r * 1.45, 7 + i), r * 0.725),
        material: mat("#8e9093"),
      },
    ]),
    // ore.glb: variants 0-2 ore (grey slate), 3-5 plain grey stone.
    "prop.ore": ["#6d737c", "#6d737c", "#6d737c", "#8e9196", "#8e9196", "#8e9196"].map((c, i) => [
      { geometry: rock(0.045, 0.8, 7 + i), material: mat(c) },
    ]),
  };
}

let cache: Record<CoastKey, PropVariant[]> | undefined;

/** Variants of the procedural kit for a coast key (built once, shared). */
export function coastFallbackVariants(key: CoastKey): PropVariant[] {
  cache ??= build();
  return cache[key];
}

function Single({ assetKey }: { assetKey: CoastKey }) {
  const parts = useMemo(() => coastFallbackVariants(assetKey)[0] ?? [], [assetKey]);
  return (
    <group>
      {parts.map((part, i) => (
        <mesh key={i} geometry={part.geometry} material={part.material} castShadow receiveShadow />
      ))}
    </group>
  );
}

export const BoulderPiece = () => <Single assetKey="prop.boulder" />;
export const CliffPiece = () => <Single assetKey="prop.cliff" />;
export const WallPiece = () => <Single assetKey="prop.wall" />;
export const TreePiece = () => <Single assetKey="prop.tree" />;
export const BushPiece = () => <Single assetKey="prop.bush" />;
export const SheepPiece = () => <Single assetKey="prop.sheep" />;
export const CampPiece = () => <Single assetKey="prop.camp" />;
export const WoodsPiece = () => <Single assetKey="prop.woods" />;
export const PeakPiece = () => <Single assetKey="prop.peak" />;
export const OrePiece = () => <Single assetKey="prop.ore" />;
