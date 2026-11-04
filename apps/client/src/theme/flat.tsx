// Flat board shapes for flat asset keys (specs/asset-theming, "Asset kinds", "Model
// coordinate contract"; design.md decision 7). One component draws both the procedural
// fallback (a key color, no map) and the themed asset (the same shape with the image as
// `map`), so swapping between them never moves or resizes anything.
//
// Contract: Y-up, 1 unit = hex circumradius, shapes lie flat on the board plane. Every
// geometry is built in the XY plane and rotated -90° about X, so shape +Y becomes -Z,
// the top of the board (row 1). Each shape's UVs span its square bounding box, so a
// square image's top edge faces the top of the board.
import {
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Float32BufferAttribute,
  RingGeometry,
  Shape,
  ShapeGeometry,
  type Texture,
} from "three";
import type { AssetKey } from "./keys.ts";
import { ISO_SIDE_HEIGHT, ISO_THICKNESS, type Projection, isoTopPixel, pixelUv } from "./relief.ts";
import { useLandRelief } from "./useLandRelief.ts";
import type { BoardStyle } from "./style.ts";

/** Hex circumradius: tiles and sea are pointy-top hexes with corners at ±Z. */
export const HEX_RADIUS = 1;
/** Width of the dark outline drawn just inside every terrain tile's edge. */
export const HEX_OUTLINE_WIDTH = 0.025;
/** Radius of the number-token disc. */
export const TOKEN_RADIUS = 0.3;
/** Side of the square, rounded harbor badge (centered on its origin). */
export const HARBOR_BADGE_SIZE = 0.42;
/** Corner radius of the harbor badge. */
export const HARBOR_BADGE_CORNER = 0.08;
/** Width of the outline drawn just inside token and badge edges. */
export const MARKER_OUTLINE_WIDTH = 0.018;

/**
 * Heights of the flat layers above the board plane (y = 0). Flat assets place themselves
 * on their layer, so callers put `<Asset>` at y = 0. Overlays drawn by the board view on
 * top of tokens and badges (labels) belong at `label`; harbor link strips at `harborLink`.
 */
export const FLAT_LAYER = {
  tile: 0,
  tileOutline: 0.001,
  harborLink: 0.002,
  marker: 0.004,
  markerOutline: 0.005,
  label: 0.006,
} as const;

/**
 * Height for a label drawn on top of the `token` asset, per board style. The "3d" style's
 * diorama token is a raised disc whose top face sits at y = 0.04.
 */
export const TOKEN_LABEL_Y: Readonly<Record<BoardStyle, number>> = {
  flat: FLAT_LAYER.label,
  "3d": 0.042,
};

export type FlatShapeKind = "hex" | "token" | "badge";

/** The shape each flat key is drawn as. Its keys are exactly the flat-kind asset keys. */
export const FLAT_SHAPE = {
  "tile.forest": "hex",
  "tile.pasture": "hex",
  "tile.fields": "hex",
  "tile.hills": "hex",
  "tile.mountains": "hex",
  "tile.desert": "hex",
  sea: "hex",
  token: "token",
  "harbor.generic": "badge",
  "harbor.brick": "badge",
  "harbor.grain": "badge",
  "harbor.lumber": "badge",
  "harbor.ore": "badge",
  "harbor.wool": "badge",
} as const satisfies Partial<Record<AssetKey, FlatShapeKind>>;

export type FlatAssetKey = keyof typeof FLAT_SHAPE;

export function isFlatAssetKey(key: AssetKey): key is FlatAssetKey {
  return key in FLAT_SHAPE;
}

function onBoardPlane<G extends BufferGeometry>(geometry: G): G {
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Remaps UVs so they span the square [-size/2, size/2]² of the XY plane. */
function squareUvs<G extends BufferGeometry>(geometry: G, size: number): G {
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, 0.5 + pos.getX(i) / size, 0.5 + pos.getY(i) / size);
  }
  uv.needsUpdate = true;
  return geometry;
}

function roundedSquare(size: number, radius: number): Shape {
  const h = size / 2;
  const r = Math.min(radius, h);
  const s = new Shape();
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r);
  s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r);
  s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

/** Lazily built, shared geometries (never disposed: they live as long as the page). */
let cache: Record<FlatShapeKind, { fill: BufferGeometry; outline: BufferGeometry }> | undefined;

export function flatGeometry(shape: FlatShapeKind): {
  fill: BufferGeometry;
  outline: BufferGeometry;
} {
  cache ??= buildGeometries();
  return cache[shape];
}

function buildGeometries() {
  const badgeOutline = roundedSquare(HARBOR_BADGE_SIZE, HARBOR_BADGE_CORNER);
  badgeOutline.holes.push(
    roundedSquare(
      HARBOR_BADGE_SIZE - 2 * MARKER_OUTLINE_WIDTH,
      HARBOR_BADGE_CORNER - MARKER_OUTLINE_WIDTH,
    ),
  );
  return {
    // Start angle π/2 puts corner 0 on +Y (→ -Z): pointy-top. CircleGeometry's UVs are
    // already 0.5 + x/2r, 0.5 + y/2r, i.e. the square image spans the hex's corners.
    hex: {
      fill: onBoardPlane(new CircleGeometry(HEX_RADIUS, 6, Math.PI / 2)),
      outline: onBoardPlane(
        new RingGeometry(HEX_RADIUS - HEX_OUTLINE_WIDTH, HEX_RADIUS, 6, 1, Math.PI / 2),
      ),
    },
    token: {
      fill: onBoardPlane(new CircleGeometry(TOKEN_RADIUS, 48)),
      outline: onBoardPlane(
        new RingGeometry(TOKEN_RADIUS - MARKER_OUTLINE_WIDTH, TOKEN_RADIUS, 48),
      ),
    },
    badge: {
      fill: onBoardPlane(
        squareUvs(
          new ShapeGeometry(roundedSquare(HARBOR_BADGE_SIZE, HARBOR_BADGE_CORNER), 6),
          HARBOR_BADGE_SIZE,
        ),
      ),
      outline: onBoardPlane(new ShapeGeometry(badgeOutline, 6)),
    },
  };
}

/** Hex corner i on the board plane: (sin(i·60°), cos(i·60°)); corner 0 at +Z. */
function corner(i: number): [number, number] {
  const a = (i * Math.PI) / 3;
  return [HEX_RADIUS * Math.sin(a), HEX_RADIUS * Math.cos(a)];
}

/** UVs of a point on the top face of an isometric hex image (see relief.ts). */
export function isoTopUv(x: number, z: number): [number, number] {
  return pixelUv(...isoTopPixel(x, z));
}

let isoCache: { top: BufferGeometry; sides: BufferGeometry } | undefined;

/**
 * Geometry for isometric tiles: the hex top face with UVs into the image's squashed hex,
 * and the six side faces of a prism of height ISO_THICKNESS below it. The two faces that
 * face the camera (corners 5→0 and 0→1) sample the image's earth band; the other four,
 * only seen when orbiting, reuse the 0→1 band.
 */
export function isoGeometry(): { top: BufferGeometry; sides: BufferGeometry } {
  if (isoCache) return isoCache;
  const top = flatGeometry("hex").fill.clone();
  const pos = top.getAttribute("position");
  const uv = top.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, ...isoTopUv(pos.getX(i), pos.getZ(i)));
  uv.needsUpdate = true;

  const positions: number[] = [];
  const uvs: number[] = [];
  const band = (x: number, z: number, down: boolean): [number, number] => {
    const [px, py] = isoTopPixel(x, z);
    return pixelUv(px, py + (down ? ISO_SIDE_HEIGHT : 0));
  };
  for (let i = 0; i < 6; i++) {
    const [ax, az] = corner(i);
    const [bx, bz] = corner((i + 1) % 6);
    // Faces 5→0 and 0→1 face +Z (the camera); the rest borrow face 0→1's band.
    const visible = i === 5 || i === 0;
    const [ux, uz, vx, vz] = visible ? [ax, az, bx, bz] : [...corner(0), ...corner(1)];
    const t = -ISO_THICKNESS;
    const quad: [number, number, number, [number, number]][] = [
      [ax, 0, az, band(ux, uz, false)],
      [bx, 0, bz, band(vx, vz, false)],
      [bx, t, bz, band(vx, vz, true)],
      [ax, t, az, band(ux, uz, true)],
    ];
    for (const k of [0, 2, 1, 0, 3, 2]) {
      const [x, y, z, [u, v]] = quad[k] ?? [0, 0, 0, [0, 0]];
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  const sides = new BufferGeometry();
  sides.setAttribute("position", new Float32BufferAttribute(positions, 3));
  sides.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  sides.computeVertexNormals();
  isoCache = { top, sides };
  return isoCache;
}

/** Side color of raised land tiles whose image (or fallback) has no earth band. */
export const EARTH_COLOR = "#6b4f33";

const OUTLINE_COLOR = "#1d1a16";

/** Whether a key draws its thin dark edge (terrain tiles, tokens, badges; not sea). */
export function hasOutline(key: FlatAssetKey): boolean {
  return key !== "sea";
}

export interface FlatShapeProps {
  assetKey: FlatAssetKey;
  /** Procedural color; ignored (white) when `map` is set so the image shows unmodified. */
  color: string;
  /** Themed image. Absent for the procedural fallback. */
  map?: Texture | undefined;
  /** How `map` is painted (hex keys only); "top" when absent. */
  projection?: Projection | undefined;
}

/**
 * Draws a flat key's shape on its layer. Fallback and themed rendering both go through
 * this component; only the material's color/map differ.
 */
export function FlatShape({ assetKey, color, map, projection = "top" }: FlatShapeProps) {
  const relief = useLandRelief();
  const shape = FLAT_SHAPE[assetKey];
  const { fill: hexFill, outline } = flatGeometry(shape);
  const iso = shape === "hex" && projection === "isometric" && map !== undefined;
  const fill = iso ? isoGeometry().top : hexFill;
  const marker = shape !== "hex";
  // On a raised island the sea and the harbors on it sit at sea level; land tops stay at 0.
  const onSea = assetKey === "sea" || assetKey.startsWith("harbor.");
  const base = onSea ? relief.seaLevel : 0;
  const land = shape === "hex" && assetKey !== "sea";
  const y = base + (marker ? FLAT_LAYER.marker : FLAT_LAYER.tile);
  const outlineY = base + (marker ? FLAT_LAYER.markerOutline : FLAT_LAYER.tileOutline);
  return (
    <group>
      {land && relief.raised && (
        <mesh geometry={isoGeometry().sides} castShadow receiveShadow>
          <meshStandardMaterial
            key={iso ? "map" : "color"}
            color={iso ? "#ffffff" : EARTH_COLOR}
            map={iso ? map : null}
            roughness={1}
            metalness={0}
            side={DoubleSide}
          />
        </mesh>
      )}
      <mesh geometry={fill} position={[0, y, 0]} receiveShadow>
        <meshStandardMaterial
          key={map ? "map" : "color"}
          color={map ? "#ffffff" : color}
          map={map ?? null}
          roughness={1}
          metalness={0}
          polygonOffset={marker}
          polygonOffsetFactor={marker ? -2 : 0}
          polygonOffsetUnits={marker ? -2 : 0}
        />
      </mesh>
      {hasOutline(assetKey) && (
        <mesh geometry={outline} position={[0, outlineY, 0]} renderOrder={1}>
          <meshBasicMaterial
            color={OUTLINE_COLOR}
            transparent
            opacity={0.35}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={marker ? -3 : -1}
            polygonOffsetUnits={marker ? -3 : -1}
          />
        </mesh>
      )}
    </group>
  );
}
