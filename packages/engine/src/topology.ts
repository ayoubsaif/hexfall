// Static board graphs, one per layout (specs/board-topology, specs/large-board):
// standard = 19 hexes, 54 intersections, 72 paths, 9 harbor slots;
// large = 30 hexes, 80 intersections, 109 paths, 11 harbor slots.
// Pure data, built once and deep-frozen. See design.md 1–2.

export type HexId = number;
export type VertexId = number;
export type EdgeId = number;

/** Which island a board uses: the 19-hex standard board or the 30-hex 5–6 player board. */
export type BoardLayout = "standard" | "large";

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
  readonly layout: BoardLayout;
  readonly hexes: readonly HexInfo[];
  readonly vertices: readonly VertexInfo[];
  readonly edges: readonly EdgeInfo[];
  /** Coastal paths (30 standard, 38 large), clockwise (row 1 at the top) from hex 0's upper-left side. */
  readonly coastalEdges: readonly EdgeId[];
  /** Harbor slot paths (9 standard, 11 large) at fixed coastal positions. */
  readonly harborSlots: readonly EdgeId[];
  /** The 6 corner hexes (3 land neighbors), indexed by axial direction (counter-clockwise on screen). */
  readonly cornerHexes: readonly HexId[];
  /** The sea cells around the island (18 standard, 22 large; rendering only). */
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

/** Coastal positions of the 9 standard harbor slots (gaps 3, 3, 4 repeating). */
const HARBOR_POSITIONS: readonly number[] = [0, 3, 6, 10, 13, 16, 20, 23, 26];

/** Coastal positions of the 11 large-board harbor slots (gaps 3, 4 alternating, then 3). */
const LARGE_HARBOR_POSITIONS: readonly number[] = [0, 3, 7, 10, 14, 17, 21, 24, 28, 31, 35];

/** [r, first q, last q] per row of the large board (rows of 3, 4, 5, 6, 5, 4, 3). */
const LARGE_ROWS: readonly (readonly [number, number, number])[] = [
  [-3, 1, 3],
  [-2, 0, 3],
  [-1, -1, 3],
  [0, -2, 3],
  [1, -2, 2],
  [2, -2, 1],
  [3, -2, 0],
];

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

interface LayoutSpec {
  readonly layout: BoardLayout;
  /** Land cells; sorted by (r, q) inside build(). */
  readonly cells: readonly { q: number; r: number }[];
  readonly harborPositions: readonly number[];
  /** Explicit sea ring order, or derived (sorted by r, q) when omitted. */
  readonly seaRing?: readonly { q: number; r: number }[];
}

function standardCells(): { q: number; r: number }[] {
  const cells: { q: number; r: number }[] = [];
  for (let r = -2; r <= 2; r++) {
    for (let q = -2; q <= 2; q++) {
      if (Math.abs(q + r) <= 2) cells.push({ q, r });
    }
  }
  return cells;
}

function largeCells(): { q: number; r: number }[] {
  const cells: { q: number; r: number }[] = [];
  for (const [r, lo, hi] of LARGE_ROWS) for (let q = lo; q <= hi; q++) cells.push({ q, r });
  return cells;
}

function build(spec: LayoutSpec): Built {
  // ---- Hexes, sorted by (r, q).
  const cells = [...spec.cells].sort((a, b) => a.r - b.r || a.q - b.q);
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
  } while (current !== startEdge && coastalEdges.length <= sortedEdges.length);

  const harborSlots: EdgeId[] = spec.harborPositions.map((p) => coastalEdges[p] ?? -1);
  const vHarbor: (number | null)[] = vertexLattice.map(() => null);
  harborSlots.forEach((e, slot) => {
    for (const v of sortedEdges[e]?.[1] ?? []) vHarbor[v] = slot;
  });

  // ---- Corner hexes: the 6 land hexes with exactly 3 land neighbors, matched to
  // each axial direction by the largest projection onto it (standard: 2·D[k]).
  const landNeighbors = (c: { q: number; r: number }): number =>
    AXIAL_DIRECTIONS.filter(([dq, dr]) => hexIdByAxial.has(`${c.q + dq},${c.r + dr}`)).length;
  const corners = cells.map((c, id) => ({ c, id })).filter(({ c }) => landNeighbors(c) === 3);
  const meanX = hexLattice.reduce((a, h) => a + h.X, 0) / hexLattice.length;
  const meanZ = hexLattice.reduce((a, h) => a + h.Z, 0) / hexLattice.length;
  const cornerHexes: HexId[] = AXIAL_DIRECTIONS.map(([dq, dr]) => {
    const dx = (2 * dq + dr) * SQRT3_2;
    const dz = (3 * dr) / 2;
    let best = -1;
    let bestDot = -Infinity;
    for (const { id } of corners) {
      const h = hexLattice[id] as Lattice;
      const dot = (h.X - meanX) * SQRT3_2 * dx + ((h.Z - meanZ) / 2) * dz;
      if (dot > bestDot) {
        bestDot = dot;
        best = id;
      }
    }
    return best;
  });

  // ---- Sea ring: explicit order, or every non-land neighbor cell sorted by (r, q).
  let seaRing: { q: number; r: number }[];
  if (spec.seaRing) {
    seaRing = [...spec.seaRing];
  } else {
    const seen = new Map<string, { q: number; r: number }>();
    for (const c of cells) {
      for (const [dq, dr] of AXIAL_DIRECTIONS) {
        const n = { q: c.q + dq, r: c.r + dr };
        const key = `${n.q},${n.r}`;
        if (!hexIdByAxial.has(key)) seen.set(key, n);
      }
    }
    seaRing = [...seen.values()].sort((a, b) => a.r - b.r || a.q - b.q);
  }

  const topology: Topology = {
    layout: spec.layout,
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
    seaRing,
  };
  return { topology, hexLattice, vertexLattice };
}

interface Geo {
  readonly hexLattice: readonly Lattice[];
  readonly vertexLattice: readonly Lattice[];
  readonly hexIdByAxial: ReadonlyMap<string, HexId>;
  /** World offset that centers the island at the origin. */
  readonly origin: XZ;
}

const GEO = new WeakMap<Topology, Geo>();

function finish(built: Built): Topology {
  const topology = deepFreeze(built.topology);
  const hexes = built.hexLattice;
  const ox = (hexes.reduce((a, h) => a + h.X, 0) / hexes.length) * SQRT3_2;
  const oz = hexes.reduce((a, h) => a + h.Z, 0) / hexes.length / 2;
  GEO.set(topology, {
    hexLattice: built.hexLattice,
    vertexLattice: built.vertexLattice,
    hexIdByAxial: new Map(topology.hexes.map((h) => [`${h.q},${h.r}`, h.id])),
    origin: [ox, oz],
  });
  return topology;
}

/** The 19-hex standard island (3–4 players). */
export const STANDARD_TOPOLOGY: Topology = finish(
  build({
    layout: "standard",
    cells: standardCells(),
    harborPositions: HARBOR_POSITIONS,
    seaRing: hexRing(3, 0),
  }),
);

/** The 30-hex large island (5–6 players). */
export const LARGE_TOPOLOGY: Topology = finish(
  build({ layout: "large", cells: largeCells(), harborPositions: LARGE_HARBOR_POSITIONS }),
);

/** The topology of a layout (undefined = standard). */
export function topologyFor(layout: BoardLayout | undefined): Topology {
  return layout === "large" ? LARGE_TOPOLOGY : STANDARD_TOPOLOGY;
}

/** The topology of a board (a board without a layout is standard). */
export function topologyOf(board: { readonly layout?: BoardLayout | undefined }): Topology {
  return topologyFor(board.layout);
}

function geo(topo: Topology): Geo {
  const g = GEO.get(topo) ?? GEO.get(topologyFor(topo.layout));
  if (!g) throw new RangeError("unknown topology");
  return g;
}

/** Hex id at axial (q, r), or undefined if (q, r) is not a land hex. */
export function hexAt(q: number, r: number, topo: Topology = STANDARD_TOPOLOGY): HexId | undefined {
  return geo(topo).hexIdByAxial.get(`${q},${r}`);
}

function checkId(kind: string, id: number, count: number): void {
  if (!Number.isInteger(id) || id < 0 || id >= count) {
    throw new RangeError(`${kind} id out of range: ${id}`);
  }
}

/** Pointy-top axial (q, r) -> world XZ, 1 unit = circumradius, centered for the topology. */
export function hexToWorld(q: number, r: number, topo: Topology = STANDARD_TOPOLOGY): XZ {
  const [ox, oz] = geo(topo).origin;
  return [Math.sqrt(3) * (q + r / 2) - ox, 1.5 * r - oz];
}

function latticeToWorld(p: Lattice, topo: Topology): XZ {
  const [ox, oz] = geo(topo).origin;
  return [p.X * SQRT3_2 - ox, p.Z / 2 - oz];
}

export function hexCenter(id: HexId, topo: Topology = STANDARD_TOPOLOGY): XZ {
  const lattice = geo(topo).hexLattice;
  checkId("hex", id, lattice.length);
  return latticeToWorld(lattice[id] as Lattice, topo);
}

export function vertexPosition(id: VertexId, topo: Topology = STANDARD_TOPOLOGY): XZ {
  const lattice = geo(topo).vertexLattice;
  checkId("vertex", id, lattice.length);
  return latticeToWorld(lattice[id] as Lattice, topo);
}

/** Midpoint of a path and its direction angle (radians, atan2 of dz over dx). */
export function edgeMidpoint(
  id: EdgeId,
  topo: Topology = STANDARD_TOPOLOGY,
): {
  readonly x: number;
  readonly z: number;
  readonly angle: number;
} {
  checkId("edge", id, topo.edges.length);
  const [a, b] = (topo.edges[id] as EdgeInfo).vertices;
  const [ax, az] = vertexPosition(a, topo);
  const [bx, bz] = vertexPosition(b, topo);
  return { x: (ax + bx) / 2, z: (az + bz) / 2, angle: Math.atan2(bz - az, bx - ax) };
}

/** Unit vector pointing away from a coastal path's only hex. */
export function edgeOutward(id: EdgeId, topo: Topology = STANDARD_TOPOLOGY): XZ {
  checkId("edge", id, topo.edges.length);
  const edge = topo.edges[id] as EdgeInfo;
  if (!edge.coastal) throw new RangeError(`edge ${id} is not coastal`);
  const { x, z } = edgeMidpoint(id, topo);
  const [cx, cz] = hexCenter(edge.hexes[0] ?? 0, topo);
  const dx = x - cx;
  const dz = z - cz;
  const len = Math.hypot(dx, dz);
  return [dx / len, dz / len];
}
