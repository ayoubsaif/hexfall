// One continuous island surface instead of 19 separate land blocks. A single mesh covers the
// land; its shader finds the hex under each point (nearest tile centre) and fades that tile's
// art into a strip of sand along its border, like the beach, so tiles never mix with each other. Toward the coast the land slopes down and turns into beach sand, so
// the island ends in a shore instead of a cliff. Each tile keeps its dome (number chips sit on
// it). Used for themes with top-down tile images; other themes keep their per-tile shapes.
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  MirroredRepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Vector2,
} from "three";
import {
  HEX_RADIUS,
  domeHeight,
  resolveWaterUrls,
  useTheme,
} from "../theme/index.ts";
import { resolveAsset } from "../theme/resolve.ts";
import type { AssetKey } from "../theme/keys.ts";
import { useViewStore } from "../store/view.ts";
import { sampleCoast } from "./coastField.ts";
import { beachHeight } from "./coastTerrain.ts";
import type { XZ } from "./layout.ts";

/** The terrain keys, in the order of the shader's texture slots. */
export const ISLAND_TERRAINS = [
  "tile.forest",
  "tile.pasture",
  "tile.fields",
  "tile.hills",
  "tile.mountains",
  "tile.desert",
] as const satisfies readonly AssetKey[];

/** Half-width (board units) of the plain sand strip between two neighbouring tiles. */
export const SAND_GAP = 0.025;
/** Width over which a tile's art fades into that sand strip. */
export const SAND_FADE = 0.12;
/** Shore distance band over which the land slopes down and turns into beach sand. */
const COAST_START = -0.32;
const COAST_END = -0.1;
/** The mesh stops a little past the land outline; the beach mesh carries on from there. */
const MESH_LIMIT = 0.1;
const STEP = 0.035;

export interface IslandTile {
  position: XZ;
  assetKey: string;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const APOTHEM = HEX_RADIUS * Math.cos(Math.PI / 6);

/** Signed distance to a pointy-top hex (negative inside). */
function hexSdf(x: number, z: number, c: XZ): number {
  const qx = Math.abs(x - c[0]);
  const qz = Math.abs(z - c[1]);
  return Math.max(qx, 0.5 * qx + 0.8660254 * qz) - APOTHEM;
}

/** Centres of the sea hexes bordering the island (land neighbours that are not land). */
export function seaRing(land: readonly XZ[]): XZ[] {
  const step = 2 * APOTHEM;
  const key = (p: XZ) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
  const isLand = new Set(land.map(key));
  const out = new Map<string, XZ>();
  for (const [x, z] of land) {
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const n: XZ = [x + step * Math.cos(a), z + step * Math.sin(a)];
      const id = key(n);
      if (!isLand.has(id)) out.set(id, n);
    }
  }
  return [...out.values()];
}

/**
 * Distance to the shore, negative on land. The coast field alone treats the border between
 * two land tiles as a shoreline (its land union is near zero there), so inland it is clamped
 * by the true distance to the nearest sea hex; at the real coast the warped field wins, which
 * keeps the shoreline wavy and matching the beach.
 */
export function islandShore(
  land: readonly XZ[],
  sea: readonly XZ[],
  x: number,
  z: number,
): number {
  const coast = sampleCoast(land, x, z).shore;
  let inLand = Infinity;
  for (const c of land) inLand = Math.min(inLand, hexSdf(x, z, c));
  // Off the land hexes the coast field is right as it is.
  if (inLand > 0) return coast;
  let toSea = Infinity;
  for (const c of sea) toSea = Math.min(toSea, hexSdf(x, z, c));
  return Math.min(coast, -toSea);
}

/** Ground height at a point: the nearest tile's dome inland, the beach profile at the coast. */
export function groundHeight(
  tiles: readonly IslandTile[],
  land: readonly XZ[],
  seaLevel: number,
  x: number,
  z: number,
  sea: readonly XZ[] = seaRing(land),
): { y: number; shore: number } {
  let best = Infinity;
  let key = "";
  for (const t of tiles) {
    const d = Math.hypot(x - t.position[0], z - t.position[1]);
    if (d < best) {
      best = d;
      key = t.assetKey;
    }
  }
  const shore = islandShore(land, sea, x, z);
  const inland = domeHeight(key, best);
  // Just above the beach mesh where they overlap, so the land always wins the depth test.
  const beach = seaLevel + beachHeight(shore) + 0.003;
  return {
    y: inland + (beach - inland) * smooth(COAST_START, COAST_END, shore),
    shore,
  };
}

/** A grid over the island's bounds, kept only where it is land or the strip just past it. */
export function islandGeometry(
  tiles: readonly IslandTile[],
  land: readonly XZ[],
  seaLevel: number,
): BufferGeometry {
  const xs = land.map((p) => p[0]);
  const zs = land.map((p) => p[1]);
  const pad = HEX_RADIUS + 0.4;
  const x0 = Math.min(...xs) - pad;
  const z0 = Math.min(...zs) - pad;
  const cols = Math.ceil((Math.max(...xs) + pad - x0) / STEP);
  const rows = Math.ceil((Math.max(...zs) + pad - z0) / STEP);
  const sea = seaRing(land);
  const pos: number[] = [];
  const shores: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = x0 + c * STEP;
      const z = z0 + r * STEP;
      const { y, shore } = groundHeight(tiles, land, seaLevel, x, z, sea);
      pos.push(x, y, z);
      shores.push(shore);
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      if ([a, b, d, e].every((i) => shores[i]! > MESH_LIMIT)) continue;
      index.push(a, d, b, b, d, e);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aShore", new Float32BufferAttribute(shores, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function prepare(t: Texture) {
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  // The image may already be uploaded (shared cache); re-upload with the sRGB setting.
  t.needsUpdate = true;
}

/** The tile image URL for each terrain, or null when any terrain has no top-down image. */
export function useIslandTextureUrls(): string[] | null {
  const { theme } = useTheme();
  return useMemo(() => {
    if (!theme) return null;
    const urls: string[] = [];
    for (const key of ISLAND_TERRAINS) {
      const r = resolveAsset(theme, key);
      if (r.kind !== "image" || r.projection === "isometric") return null;
      urls.push(r.url);
    }
    return urls;
  }, [theme]);
}

export function IslandGround({
  tiles,
  land,
  seaLevel,
  urls,
}: {
  tiles: readonly IslandTile[];
  land: readonly XZ[];
  seaLevel: number;
  urls: string[];
}) {
  const { theme } = useTheme();
  const softTiles = useViewStore((s) => s.softTiles);
  const sandUrl = theme ? resolveWaterUrls(theme).sand : undefined;
  const art = useTexture(urls, (t) =>
    (Array.isArray(t) ? t : [t]).forEach(prepare),
  ) as Texture[];
  // useTexture needs a URL; a tile image stands in when the theme has no sand (then unused).
  const sand = useTexture(sandUrl ?? urls[0]!, (t) => {
    const x = t as Texture;
    x.wrapS = x.wrapT = MirroredRepeatWrapping;
    x.colorSpace = SRGBColorSpace;
    x.anisotropy = 4;
  }) as Texture;
  const geometry = useMemo(
    () => islandGeometry(tiles, land, seaLevel),
    [tiles, land, seaLevel],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const terrainIndex = (key: string) =>
    Math.max(
      0,
      ISLAND_TERRAINS.indexOf(key as (typeof ISLAND_TERRAINS)[number]),
    );
  const n = tiles.length;
  const material = useMemo(
    () => ({
      onBeforeCompile: (shader: {
        vertexShader: string;
        fragmentShader: string;
        uniforms: Record<string, { value: unknown }>;
      }) => {
        shader.uniforms.uCenters = {
          value: tiles.map((t) => new Vector2(t.position[0], t.position[1])),
        };
        shader.uniforms.uTerrain = {
          value: tiles.map((t) => terrainIndex(t.assetKey)),
        };
        art.forEach((tex, i) => (shader.uniforms[`uTex${i}`] = { value: tex }));
        shader.uniforms.uSand = { value: sand };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute float aShore;\nvarying vec2 vP;\nvarying float vShore;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvP = position.xz;\nvShore = aShore;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
            #define ISLAND_N ${n}
            varying vec2 vP;
            varying float vShore;
            uniform vec2 uCenters[ISLAND_N];
            uniform int uTerrain[ISLAND_N];
            ${ISLAND_TERRAINS.map((_, i) => `uniform sampler2D uTex${i};`).join("\n")}
            uniform sampler2D uSand;
            vec4 terrainArt(int t, vec2 uv) {
              ${ISLAND_TERRAINS.map((_, i) => `if (t == ${i}) return texture2D(uTex${i}, uv);`).join("\n")}
              return vec4(0.5, 0.5, 0.5, 1.0);
            }
            // How much of a tile's art counts here: inside its own hexagon (fading out just past
            // the edge) and only where the image is opaque. The square image's corners outside
            // the hexagon are transparent and must never show (they read as black or white).
            float artWeight(vec2 c, float alpha) {
              vec2 q = abs(vP - c);
              float sdf = max(q.x, dot(q, vec2(0.5, 0.8660254))) - ${(HEX_RADIUS * Math.cos(Math.PI / 6)).toFixed(7)};
              return (1.0 - smoothstep(-0.02, 0.06, sdf)) * smoothstep(0.05, 0.6, alpha);
            }
            // Same mapping as a single tile: the square image spans the hex corners.
            vec2 tileUv(vec2 c) {
              return 0.5 + vec2(vP.x - c.x, -(vP.y - c.y)) / ${(2 * HEX_RADIUS).toFixed(1)};
            }`,
          )
          .replace(
            "#include <map_fragment>",
            `{
              float d1 = 1e9; float d2 = 1e9; int i1 = 0; int i2 = 0;
              for (int i = 0; i < ISLAND_N; i++) {
                vec2 q = vP - uCenters[i];
                float dd = dot(q, q);
                if (dd < d1) { d2 = d1; i2 = i1; d1 = dd; i1 = i; }
                else if (dd < d2) { d2 = dd; i2 = i; }
              }
              vec2 c1 = uCenters[i1];
              vec2 c2 = uCenters[i2];
              // Distance to the shared border (the bisector of the two nearest centres).
              float e = (d2 - d1) / (2.0 * length(c2 - c1));
              // Each tile keeps its own art and fades into a strip of sand at its border,
              // the same gradient as the beach, so terrains never mix with each other.
              vec4 a1 = terrainArt(uTerrain[i1], tileUv(c1));
              float cover = artWeight(c1, a1.a)
                * smoothstep(${SAND_GAP.toFixed(3)}, ${(SAND_GAP + SAND_FADE).toFixed(3)}, e);
              vec3 col = a1.rgb;
              ${
                softTiles
                  ? `float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
              col = mix(vec3(0.6, 0.58, 0.52), mix(vec3(l), col, 0.9), 0.85);`
                  : ""
              }
              // Land slopes into the beach.
              vec3 sandC = ${
                sandUrl
                  ? "texture2D(uSand, vP * 0.7).rgb * vec3(0.937, 0.886, 0.741)"
                  : "vec3(0.84, 0.74, 0.52)"
              };
              // Where no tile has art (outside every hexagon), the ground is sand.
              col = mix(sandC, col, cover);
              col = mix(col, sandC, smoothstep(${COAST_START}, ${COAST_END}, vShore));
              diffuseColor.rgb *= col;
            }`,
          );
      },
      customProgramCacheKey: () =>
        `island-ground-${n}-${softTiles ? "soft" : "plain"}-${sandUrl ? "sand" : "nosand"}`,
    }),
    // Tiles and textures are fixed for a board and theme; remount on change via the key below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tiles, art, sand, softTiles, sandUrl, n],
  );
  return (
    <mesh geometry={geometry} receiveShadow raycast={() => {}}>
      <meshStandardMaterial
        key={`${softTiles}-${sandUrl}-${urls.join()}`}
        roughness={1}
        metalness={0}
        {...material}
      />
    </mesh>
  );
}
