// Static board graph: 19 hexes, 54 intersections, 72 paths, coast and harbor slots
// (specs/board-topology). Pure data, built once and deep-frozen. See design.md 1–2.

export type HexId = number;
export type VertexId = number;
export type EdgeId = number;

export interface HexInfo {
  readonly id: HexId;
  readonly q: number;
  readonly r: number;
  /** 6 corner intersections; corner i is at world offset (sin(i·60°), cos(i·60°)). */
  readonly vertices: readonly VertexId[];
  /** 6 side paths; side i runs from corner i to corner i+1. */
  readonly edges: readonly EdgeId[];
}

export interface VertexInfo {
  readonly id: VertexId;
  readonly hexes: readonly HexId[];
  readonly edges: readonly EdgeId[];
  readonly neighbors: readonly VertexId[];
  readonly coastal: boolean;
  readonly harborSlot: number | null;
}

export interface EdgeInfo {
  readonly id: EdgeId;
  readonly vertices: readonly [VertexId, VertexId];
  readonly hexes: readonly HexId[];
  readonly coastal: boolean;
}

export interface Topology {
  readonly hexes: readonly HexInfo[];
  readonly vertices: readonly VertexInfo[];
  readonly edges: readonly EdgeInfo[];
  /** 30 coastal paths, clockwise (row 1 at the top) from hex 0's upper-left side. */
  readonly coastalEdges: readonly EdgeId[];
  /** 9 harbor slot paths, at coastal positions 0,3,6,10,13,16,20,23,26. */
  readonly harborSlots: readonly EdgeId[];
  /** The 6 ring-2 corner hexes, indexed by axial direction (counter-clockwise on screen). */
  readonly cornerHexes: readonly HexId[];
  /** The 18 ring-3 sea cells around the island (rendering only). */
  readonly seaRing: readonly { readonly q: number; readonly r: number }[];
}

export type XZ = readonly [number, number];

/** Axial directions, counter-clockwise on screen (x right, z down). */
export const AXIAL_DIRECTIONS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([1, 0] as const),
  Object.freeze([1, -1] as const),
  Object.freeze([0, -1] as const),
  Object.freeze([-1, 0] as const),
  Object.freeze([-1, 1] as const),
  Object.freeze([0, 1] as const),
]);

/** Integer lattice offsets of corners 0..5 from a hex center (design.md decision 1). */
const CORNER_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 2],
  [1, 1],
  [1, -1],
  [0, -2],
  [-1, -1],
  [-1, 1],
];

/** Coastal positions of the 9 harbor slots (gaps 3, 3, 4 repeating). */
const HARBOR_POSITIONS: readonly number[] = [0, 3, 6, 10, 13, 16, 20, 23, 26];

const SQRT3_2 = Math.sqrt(3) / 2;

function dir(k: number): readonly [number, number] {
  return AXIAL_DIRECTIONS[((k % 6) + 6) % 6] as readonly [number, number];
}

/**
 * Axial cells of the ring at distance `rad`, starting at rad·D[k] and walking
 * counter-clockwise on screen (rad·6 cells; rad 0 gives just the center).
 */
export function hexRing(rad: number, k: number): { q: number; r: number }[] {
  if (rad === 0) return [{ q: 0, r: 0 }];
  const [dq, dr] = dir(k);
  let q = dq * rad;
  let r = dr * rad;
  const out: { q: number; r: number }[] = [];
  for (let side = 0; side < 6; side++) {
    const [sq, sr] = dir(k + 2 + side);
    for (let j = 0; j < rad; j++) {
      out.push({ q, r });
      q += sq;
      r += sr;
    }
  }
  return out;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

type Lattice = { readonly X: number; readonly Z: number };

interface Built {
  topology: Topology;
  hexLattice: readonly Lattice[];
  vertexLattice: readonly Lattice[];
}

function build(): Built {
  // ---- Hexes, sorted by (r, q).
  const cells: { q: number; r: number }[] = [];
  for (let r = -2; r <= 2; r++) {
    for (let q = -2; q <= 2; q++) {
      if (Math.abs(q + r) <= 2) cells.push({ q, r });
    }
  }
  const hexIdByAxial = new Map<string, HexId>();
  cells.forEach((c, i) => hexIdByAxial.set(`${c.q},${c.r}`, i));
  const hexLattice: Lattice[] = cells.map((c) => ({ X: 2 * c.q + c.r, Z: 3 * c.r }));

  // ---- Intersections: dedupe corner lattice points, sort by (Z, X).
  const cornerKeys: string[][] = [];
  const points = new Map<string, Lattice>();
  hexLattice.forEach((h) => {
    const keys: string[] = [];
    for (const [ox, oz] of CORNER_OFFSETS) {
      const X = h.X + ox;
      const Z = h.Z + oz;
      const key = `${X},${Z}`;
      points.set(key, { X, Z });
      keys.push(key);
    }
    cornerKeys.push(keys);
  });
  const sortedPoints = [...points.entries()].sort((a, b) => a[1].Z - b[1].Z || a[1].X - b[1].X);
  const vertexIdByKey = new Map<string, VertexId>();
  sortedPoints.forEach(([key], i) => vertexIdByKey.set(key, i));
  const vertexLattice: Lattice[] = sortedPoints.map(([, p]) => p);
  const hexVertices: VertexId[][] = cornerKeys.map((keys) =>
    keys.map((k) => vertexIdByKey.get(k) ?? -1),
  );

  // ---- Paths: sorted vertex pairs, sorted by midpoint (Z1+Z2, X1+X2).
  const edgeEnds = new Map<string, [VertexId, VertexId]>();
  const sideKeys: string[][] = hexVertices.map((vs) => {
    const keys: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = vs[i] ?? -1;
      const b = vs[(i + 1) % 6] ?? -1;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo}-${hi}`;
      edgeEnds.set(key, [lo, hi]);
      keys.push(key);
    }
    return keys;
  });
  const mid = (e: [VertexId, VertexId]): Lattice => {
    const a = vertexLattice[e[0]] as Lattice;
    const b = vertexLattice[e[1]] as Lattice;
    return { X: a.X + b.X, Z: a.Z + b.Z };
  };
  const sortedEdges = [...edgeEnds.entries()].sort((a, b) => {
    const ma = mid(a[1]);
    const mb = mid(b[1]);
    return ma.Z - mb.Z || ma.X - mb.X;
  });
  const edgeIdByKey = new Map<string, EdgeId>();
  sortedEdges.forEach(([key], i) => edgeIdByKey.set(key, i));
  const hexEdges: EdgeId[][] = sideKeys.map((keys) => keys.map((k) => edgeIdByKey.get(k) ?? -1));

  // ---- Relations.
  const vHexes: HexId[][] = vertexLattice.map(() => []);
  const vEdges: EdgeId[][] = vertexLattice.map(() => []);
  const vNeighbors: VertexId[][] = vertexLattice.map(() => []);
  const eHexes: HexId[][] = sortedEdges.map(() => []);
  hexVertices.forEach((vs, h) => vs.forEach((v) => vHexes[v]?.push(h)));
  hexEdges.forEach((es, h) => es.forEach((e) => eHexes[e]?.push(h)));
  sortedEdges.forEach(([, [a, b]], e) => {
    vEdges[a]?.push(e);
    vEdges[b]?.push(e);
    vNeighbors[a]?.push(b);
    vNeighbors[b]?.push(a);
  });
  const asc = (x: number, y: number): number => x - y;
  for (const list of [...vHexes, ...vEdges, ...vNeighbors, ...eHexes]) list.sort(asc);

  const edgeCoastal = eHexes.map((hs) => hs.length === 1);

  // ---- Clockwise coastal walk: hex 0 side 3 (corner 3 -> 4, upper-left), walked
  // from corner 4 toward corner 3, then on to hex 0's upper-right side.
  const coastalEdges: EdgeId[] = [];
  const startEdge = hexEdges[0]?.[3] ?? -1;
  let current = startEdge;
  let end = hexVertices[0]?.[3] ?? -1;
  do {
    coastalEdges.push(current);
    const next = (vEdges[end] ?? []).find((e) => e !== current && edgeCoastal[e] === true);
    if (next === undefined) throw new Error("topology: broken coastline");
    const [a, b] = sortedEdges[next]?.[1] ?? [-1, -1];
    end = a === end ? b : a;
    current = next;
  } while (current !== startEdge && coastalEdges.length <= 72);

  const harborSlots: EdgeId[] = HARBOR_POSITIONS.map((p) => coastalEdges[p] ?? -1);
  const vHarbor: (number | null)[] = vertexLattice.map(() => null);
  harborSlots.forEach((e, slot) => {
    for (const v of sortedEdges[e]?.[1] ?? []) vHarbor[v] = slot;
  });

  const cornerHexes: HexId[] = AXIAL_DIRECTIONS.map(
    ([dq, dr]) => hexIdByAxial.get(`${2 * dq},${2 * dr}`) ?? -1,
  );

  const topology: Topology = {
    hexes: cells.map((c, id) => ({
      id,
      q: c.q,
      r: c.r,
      vertices: hexVertices[id] ?? [],
      edges: hexEdges[id] ?? [],
    })),
    vertices: vertexLattice.map((_, id) => ({
      id,
      hexes: vHexes[id] ?? [],
      edges: vEdges[id] ?? [],
      neighbors: vNeighbors[id] ?? [],
      coastal: (vHexes[id] ?? []).length < 3,
      harborSlot: vHarbor[id] ?? null,
    })),
    edges: sortedEdges.map(([, vertices], id) => ({
      id,
      vertices,
      hexes: eHexes[id] ?? [],
      coastal: edgeCoastal[id] ?? false,
    })),
    coastalEdges,
    harborSlots,
    cornerHexes,
    seaRing: hexRing(3, 0),
  };
  return { topology, hexLattice, vertexLattice };
}

const BUILT = build();
const HEX_LATTICE = BUILT.hexLattice;
const VERTEX_LATTICE = BUILT.vertexLattice;

export const TOPOLOGY: Topology = deepFreeze(BUILT.topology);

const HEX_ID_BY_AXIAL: ReadonlyMap<string, HexId> = new Map(
  TOPOLOGY.hexes.map((h) => [`${h.q},${h.r}`, h.id]),
);

/** Hex id at axial (q, r), or undefined if (q, r) is not a land hex. */
export function hexAt(q: number, r: number): HexId | undefined {
  return HEX_ID_BY_AXIAL.get(`${q},${r}`);
}

function checkId(kind: string, id: number, count: number): void {
  if (!Number.isInteger(id) || id < 0 || id >= count) {
    throw new RangeError(`${kind} id out of range: ${id}`);
  }
}

/** Pointy-top axial (q, r) -> world XZ, 1 unit = circumradius. */
export function hexToWorld(q: number, r: number): XZ {
  return [Math.sqrt(3) * (q + r / 2), 1.5 * r];
}

export function hexCenter(id: HexId): XZ {
  checkId("hex", id, HEX_LATTICE.length);
  const p = HEX_LATTICE[id] as Lattice;
  return [p.X * SQRT3_2, p.Z / 2];
}

export function vertexPosition(id: VertexId): XZ {
  checkId("vertex", id, VERTEX_LATTICE.length);
  const p = VERTEX_LATTICE[id] as Lattice;
  return [p.X * SQRT3_2, p.Z / 2];
}

/** Midpoint of a path and its direction angle (radians, atan2 of dz over dx). */
export function edgeMidpoint(id: EdgeId): {
  readonly x: number;
  readonly z: number;
  readonly angle: number;
} {
  checkId("edge", id, TOPOLOGY.edges.length);
  const [a, b] = (TOPOLOGY.edges[id] as EdgeInfo).vertices;
  const [ax, az] = vertexPosition(a);
  const [bx, bz] = vertexPosition(b);
  return { x: (ax + bx) / 2, z: (az + bz) / 2, angle: Math.atan2(bz - az, bx - ax) };
}

/** Unit vector pointing away from a coastal path's only hex. */
export function edgeOutward(id: EdgeId): XZ {
  checkId("edge", id, TOPOLOGY.edges.length);
  const edge = TOPOLOGY.edges[id] as EdgeInfo;
  if (!edge.coastal) throw new RangeError(`edge ${id} is not coastal`);
  const { x, z } = edgeMidpoint(id);
  const [cx, cz] = hexCenter(edge.hexes[0] ?? 0);
  const dx = x - cx;
  const dz = z - cz;
  const len = Math.hypot(dx, dz);
  return [dx / len, dz / len];
}
