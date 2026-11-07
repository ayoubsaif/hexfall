// Keeps the sea out of the harbor boats (specs/board-view "Harbor markers"). The sea plane runs
// through the open hull, so an invisible lid across the hull's rim writes depth only: it is drawn
// after the boat (whose floor and thwarts already show) and before the sea, which then fails the
// depth test inside the hull. Pure outline maths is separate so it is unit-testable.
import {
  type BufferAttribute,
  type BufferGeometry,
  type InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  Shape,
  ShapeGeometry,
} from "three";

/** Draw order: boat (0) → lid (1) → sea (2). */
export const HULL_MASK_ORDER = 1;
export const SEA_ORDER = 2;
export const HULL_MASK_NAME = "Hull Water Mask";

/** Lid height as a share of the hull's top: just under the rim, inside the walls. */
const RIM_SHARE = 0.95;
/** Vertices this high up the hull (share of its top) outline the deck opening. */
const TOP_SHARE = 0.85;
/** Pulls the outline toward its centre so the lid stays inside the hull walls. */
const INSET = 0.94;

export interface HullOutline {
  /** Convex outline of the hull's top in (x, z), counter-clockwise, already inset. */
  readonly points: readonly (readonly [number, number])[];
  /** Lid height in the hull mesh's frame. */
  readonly y: number;
}

/** The hull's deck outline from its vertex positions; null for a degenerate hull. */
export function hullOutline(
  positions: BufferAttribute | InterleavedBufferAttribute,
): HullOutline | null {
  let top = -Infinity;
  for (let i = 0; i < positions.count; i++) top = Math.max(top, positions.getY(i));
  if (!(top > 0)) return null;
  const pts: [number, number][] = [];
  for (let i = 0; i < positions.count; i++)
    if (positions.getY(i) >= top * TOP_SHARE) pts.push([positions.getX(i), positions.getZ(i)]);
  const hull = convexHull(pts);
  if (hull.length < 3) return null;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of hull) {
    cx += x;
    cz += z;
  }
  cx /= hull.length;
  cz /= hull.length;
  return {
    points: hull.map(([x, z]) => [cx + (x - cx) * INSET, cz + (z - cz) * INSET] as const),
    y: top * RIM_SHARE,
  };
}

/** Andrew's monotone chain; counter-clockwise, no collinear points. */
function convexHull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const lids = new WeakMap<BufferGeometry, ShapeGeometry | null>();
const maskMaterial = new MeshBasicMaterial({ colorWrite: false });
maskMaterial.name = HULL_MASK_NAME;

function lidGeometry(hull: BufferGeometry): ShapeGeometry | null {
  if (lids.has(hull)) return lids.get(hull) ?? null;
  const outline = hullOutline(hull.getAttribute("position"));
  let geometry: ShapeGeometry | null = null;
  if (outline) {
    // The shape lies in XY; rotated −90° about X, shape y becomes −z, so store −z.
    const shape = new Shape(outline.points.map(([x, z]) => ({ x, y: -z }) as never));
    geometry = new ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, outline.y, 0);
  }
  lids.set(hull, geometry);
  return geometry;
}

/** Adds the depth-only lid to the first hull mesh under `root`, once. */
export function addHullMask(root: Object3D): void {
  let hull: Mesh | null = null;
  root.traverse((n) => {
    if (!hull && n instanceof Mesh && /hull/i.test(n.name)) hull = n;
  });
  const found = hull as Mesh | null;
  if (!found || found.children.some((c) => c.name === HULL_MASK_NAME)) return;
  const geometry = lidGeometry(found.geometry);
  if (!geometry) return;
  const lid = new Mesh(geometry, maskMaterial);
  lid.name = HULL_MASK_NAME;
  lid.renderOrder = HULL_MASK_ORDER;
  lid.raycast = () => {};
  found.add(lid);
}
