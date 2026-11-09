// Procedural die for `dice.die`: a classic ivory die with dark pips set into the faces. The
// body is a cube cut by a sphere (flat round faces, rounded corners), centered on its origin
// with the values on the contract axes (theme/die.ts), so it can stand in for the GLB.
import {
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  Path,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import {
  DIE_BODY_COLOR,
  DIE_EDGE,
  DIE_FACE_AXES,
  DIE_PIP_COLOR,
  DIE_VALUES,
  PIP_DEPTH,
  PIP_RADIUS,
  pipPositions,
  SPHERE_RATIO,
  type Pip,
} from "../die.ts";

const UP = new Vector3(0, 1, 0);
const PIP_SEGMENTS = 32;

/** Steps along each square edge of a face, and rings on the rounded rim. */
const EDGE_STEPS = 24;
const RIM_RINGS = 8;

type Axis3 = readonly [number, number, number];

/** Per face: outward normal n and in-plane axes a, b with a × b = n. */
const FACES: readonly (readonly [Axis3, Axis3, Axis3])[] = [
  [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  [
    [-1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  [
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 0],
  ],
  [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
  ],
  [
    [0, 0, -1],
    [0, 1, 0],
    [1, 0, 0],
  ],
];

const dot = (p: readonly number[], q: readonly number[]) =>
  p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;

/** The pips on the face with outward normal n. */
function facePips(n: Axis3): Pip[] {
  const value = DIE_VALUES.find((v) => dot(DIE_FACE_AXES[v], n) === 1)!;
  return pipPositions(value);
}

function circle(x: number, y: number, r: number): Vector2[] {
  return Array.from({ length: PIP_SEGMENTS }, (_, i) => {
    const t = (i / PIP_SEGMENTS) * Math.PI * 2;
    return new Vector2(x + Math.cos(t) * r, y + Math.sin(t) * r);
  });
}

/**
 * The body, the intersection of the cube and a sphere. Each face is a flat disc out to the
 * circle where the sphere crosses the face plane, with a round hole for every pip, then a
 * rim from that circle out to the face's square border, lifted onto the sphere. The disc and
 * the rim do not share vertices, so the circle stays a clean crease. Every face samples its
 * square border evenly from corner to corner, so neighbouring faces meet on identical points.
 */
function dieBodyGeometry(): BufferGeometry {
  const half = DIE_EDGE / 2;
  const radius = half * SPHERE_RATIO;
  const disc = Math.sqrt(radius * radius - half * half);
  const ring = 4 * EDGE_STEPS;

  // Square border in face coordinates, counter-clockwise.
  const corners = [
    [half, -half],
    [half, half],
    [-half, half],
    [-half, -half],
  ] as const;
  const border: [number, number][] = [];
  for (let c = 0; c < 4; c++) {
    const [x0, y0] = corners[c]!;
    const [x1, y1] = corners[(c + 1) % 4]!;
    for (let s = 0; s < EDGE_STEPS; s++) {
      const t = s / EDGE_STEPS;
      border.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  const rimCircle = border.map(([x, y]) => {
    const len = Math.hypot(x, y);
    return [(x / len) * disc, (y / len) * disc] as const;
  });

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const v = new Vector3();

  for (const [n, a, b] of FACES) {
    const onFace = (x: number, y: number) => [
      n[0] * half + a[0] * x + b[0] * y,
      n[1] * half + a[1] * x + b[1] * y,
      n[2] * half + a[2] * x + b[2] * y,
    ];

    // Flat disc with the pip holes, triangulated in face coordinates.
    const shape = new Shape(rimCircle.map(([x, y]) => new Vector2(x, y)));
    for (const pip of facePips(n)) {
      const x = dot(pip.position, a);
      const y = dot(pip.position, b);
      shape.holes.push(new Path(circle(x, y, PIP_RADIUS)));
    }
    const flat = new ShapeGeometry(shape);
    const fp = flat.getAttribute("position");
    const base = positions.length / 3;
    for (let i = 0; i < fp.count; i++) {
      positions.push(...onFace(fp.getX(i), fp.getY(i)));
      normals.push(n[0], n[1], n[2]);
    }
    const fi = flat.getIndex()!;
    for (let i = 0; i < fi.count; i++) indices.push(base + fi.getX(i));
    flat.dispose();

    // Rim: from the circle (j = 0) out to the square border (j = RIM_RINGS).
    const rimBase = positions.length / 3;
    for (let j = 0; j <= RIM_RINGS; j++) {
      const t = j / RIM_RINGS;
      border.forEach(([x, y], k) => {
        const [cx, cy] = rimCircle[k]!;
        v.fromArray(onFace(cx + (x - cx) * t, cy + (y - cy) * t)).normalize();
        positions.push(v.x * radius, v.y * radius, v.z * radius);
        normals.push(v.x, v.y, v.z);
      });
    }
    for (let j = 0; j < RIM_RINGS; j++) {
      const inner = rimBase + j * ring;
      const outer = inner + ring;
      for (let k = 0; k < ring; k++) {
        const k1 = (k + 1) % ring;
        indices.push(inner + k, outer + k, outer + k1, inner + k, outer + k1, inner + k1);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * One pip: a shallow spherical bowl whose rim fills a hole in the face and whose bottom sits
 * PIP_DEPTH below it, local +Y out of the face. Drawn from the inside (BackSide).
 */
function pipGeometry(): SphereGeometry {
  const r = PIP_RADIUS;
  const d = PIP_DEPTH;
  const s = (r * r + d * d) / (2 * d);
  const open = Math.asin(r / s);
  const g = new SphereGeometry(s, PIP_SEGMENTS, 6, 0, Math.PI * 2, Math.PI - open, open);
  g.translate(0, s - d, 0);
  return g;
}

const BODY = dieBodyGeometry();
const PIP = pipGeometry();

const PIPS = DIE_VALUES.flatMap((value) =>
  pipPositions(value).map((pip, i) => ({
    key: `${value}-${i}`,
    position: pip.position,
    quaternion: new Quaternion().setFromUnitVectors(UP, new Vector3(...pip.normal)),
  })),
);

export function DiePiece() {
  return (
    <group>
      <mesh geometry={BODY} castShadow>
        <meshStandardMaterial color={DIE_BODY_COLOR} roughness={0.4} />
      </mesh>
      {PIPS.map((p) => (
        <mesh key={p.key} geometry={PIP} position={p.position} quaternion={p.quaternion}>
          <meshStandardMaterial color={DIE_PIP_COLOR} roughness={0.6} side={BackSide} />
        </mesh>
      ))}
    </group>
  );
}
