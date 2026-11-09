// One continuous island surface instead of 19 separate land blocks. A single mesh covers the
// land; its shader finds the hex under each point (nearest tile centre) and fades that tile's
// art into a strip of sand along its border, like the beach, so tiles never mix with each other. Toward the coast the land slopes down and turns into beach sand, so
// the island ends in a shore instead of a cliff. Each tile keeps its dome (number chips sit on
// it). Used for themes with top-down tile images; other themes keep their per-tile shapes.
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MirroredRepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Vector2,
  Vector4,
} from "three";
import { HEX_RADIUS, domeHeight, resolveWaterUrls, useTheme } from "../theme/index.ts";
import { resolveAsset } from "../theme/resolve.ts";
import type { AssetKey } from "../theme/keys.ts";
import { useViewStore } from "../store/view.ts";
import { sampleCoast } from "./coastField.ts";
import { beachHeight } from "./coastTerrain.ts";
import type { XZ } from "./layout.ts";
import type { CampGround } from "./pastureSheep.ts";
import { GRASS_COLOR, TEXTURE_MEAN, useCoastTextures } from "./coastMaterials.ts";
import { QUALITY_RICH, useGraphicsQuality } from "./graphicsQuality.ts";

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
/** Island-shore band of the grass rim outside the coastal hexes (specs/coast-dressing): seams
 * between land tiles sit at about -0.43, so the band starts above that and keeps them sand. */
export const RIM_GRASS_START = -0.36;
export const RIM_GRASS_END = -0.07;
/** Ground colour of forest hexes when they carry 3D trees (specs/forest-trees). */
export const FOREST_GRASS = "#557a2f";
/** Ground colour of pasture hexes when sheep graze them (specs/pasture-meadow): brighter and
 * yellower than the forest floor so the two never read alike. */
export const PASTURE_GRASS = "#8fb84a";
/** Grass map strength on the island (stronger than the beach: blades read at board scale). */
const GRASS_DETAIL = 0.9;

/** The mesh stops a little past the land outline; the beach mesh carries on from there. */
const MESH_LIMIT = 0.1;
const STEP = 0.035;

/** sRGB hex -> GLSL linear vec3. */
function glslColor(hex: string): string {
  const c = new Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

export interface IslandTile {
  position: XZ;
  assetKey: string;
  /** Sandy path of a pasture's sheep camp (Medium/High only). */
  camp?: CampGround | null;
}

/** Mountain floor colours (specs/mountain-peaks): tan scree, grey rock and dry grass. */
export const MOUNTAIN_SCREE = "#a3a29c";
const MOUNTAIN_ROCK = "#83868a";
const MOUNTAIN_GRASS = "#7f9a52";
/** Half-width of the sheep camp path (specs/pasture-meadow). */
export const CAMP_PATH_WIDTH = 0.032;

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
export function islandShore(land: readonly XZ[], sea: readonly XZ[], x: number, z: number): number {
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
  // Medium/High: forest hexes become grass under 3D trees (specs/forest-trees) and pastures
  // become meadows with sheep (specs/pasture-meadow).
  const richForest = QUALITY_RICH[useGraphicsQuality()];
  const grassMap = useCoastTextures().grass ?? null;
  const sandUrl = theme ? resolveWaterUrls(theme).sand : undefined;
  const art = useTexture(urls, (t) => (Array.isArray(t) ? t : [t]).forEach(prepare)) as Texture[];
  // useTexture needs a URL; a tile image stands in when the theme has no sand (then unused).
  const sand = useTexture(sandUrl ?? urls[0]!, (t) => {
    const x = t as Texture;
    x.wrapS = x.wrapT = MirroredRepeatWrapping;
    x.colorSpace = SRGBColorSpace;
    x.anisotropy = 4;
  }) as Texture;
  const geometry = useMemo(() => islandGeometry(tiles, land, seaLevel), [tiles, land, seaLevel]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const terrainIndex = (key: string) =>
    Math.max(0, ISLAND_TERRAINS.indexOf(key as (typeof ISLAND_TERRAINS)[number]));
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
        // The camp path's five points (four straight legs), two per vec4 plus the end point;
        // zeros = no path.
        const pathPart = (t: IslandTile, k: number) => {
          const p = t.camp?.path;
          return p && p.length >= 10
            ? new Vector4(p[k]!, p[k + 1]!, p[k + 2] ?? 0, p[k + 3] ?? 0)
            : new Vector4();
        };
        shader.uniforms.uPathA = { value: tiles.map((t) => pathPart(t, 0)) };
        shader.uniforms.uPathB = { value: tiles.map((t) => pathPart(t, 4)) };
        shader.uniforms.uPathC = { value: tiles.map((t) => pathPart(t, 8)) };
        art.forEach((tex, i) => (shader.uniforms[`uTex${i}`] = { value: tex }));
        shader.uniforms.uSand = { value: sand };
        shader.uniforms.uGrass = { value: grassMap };
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
            uniform vec4 uPathA[ISLAND_N];
            uniform vec4 uPathB[ISLAND_N];
            uniform vec4 uPathC[ISLAND_N];
            ${ISLAND_TERRAINS.map((_, i) => `uniform sampler2D uTex${i};`).join("\n")}
            uniform sampler2D uSand;
            uniform sampler2D uGrass;
            float gHash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            float gNoise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x),
                         mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
            }
            // Grass: light and shade patches, sun-dried spots and lusher clumps, and the grass
            // map at two scales so its tiling never lines up.
            vec3 grassAt(vec3 tint) {
              float n1 = gNoise(vP * 1.4);
              float n2 = gNoise(vP * 4.3 + 7.31);
              vec3 c = tint * mix(0.8, 1.16, n1 * 0.65 + n2 * 0.35);
              c = mix(c, c * vec3(1.22, 1.1, 0.62), smoothstep(0.6, 0.85, n1) * 0.5);
              c = mix(c, c * vec3(0.78, 0.92, 0.8), smoothstep(0.42, 0.15, n2) * 0.45);
              // Fine blade grain, faded out as it gets smaller than a pixel (no shimmer).
              float px = length(fwidth(vP));
              float b1 = gNoise(vP * 38.0), b2 = gNoise(vP * 97.0 + 1.7);
              c *= 1.0 + (b1 - 0.5) * 0.3 * (1.0 - smoothstep(0.25, 0.7, px * 38.0))
                       + (b2 - 0.5) * 0.24 * (1.0 - smoothstep(0.25, 0.7, px * 97.0));
              ${
                grassMap
                  ? `vec3 g = mix(texture2D(uGrass, vP * 1.7).rgb,
                             texture2D(uGrass, vP * 0.53 + vec2(0.37, 0.71)).rgb, 0.4);
              c *= mix(vec3(1.0), g / vec3(${TEXTURE_MEAN.grass.map((v) => v.toFixed(3)).join(", ")}), ${GRASS_DETAIL.toFixed(2)});`
                  : ""
              }
              return c;
            }
            // Forest floor (Medium/High): darker, mossier grass with patches of brown needles.
            vec3 forestFloor() {
              vec3 c = grassAt(${glslColor(FOREST_GRASS)});
              float litter = smoothstep(0.55, 0.8, gNoise(vP * 2.6 + 3.7));
              return mix(c, c * vec3(1.05, 0.82, 0.55), litter * 0.6);
            }
            // Meadow (Medium/High): bright grass with lusher clover patches and tiny white and
            // yellow flowers that fade out before they can shimmer when zoomed out.
            vec3 meadowFloor() {
              vec3 c = grassAt(${glslColor(PASTURE_GRASS)});
              float clover = smoothstep(0.58, 0.82, gNoise(vP * 3.1 + 11.3));
              c = mix(c, c * vec3(0.86, 1.08, 0.82), clover * 0.5);
              float px = length(fwidth(vP));
              float fade = 1.0 - smoothstep(0.3, 0.8, px * 60.0);
              vec2 cell = floor(vP * 60.0);
              vec2 f = fract(vP * 60.0) - 0.5;
              float h = gHash(cell);
              float dotMask = (1.0 - smoothstep(0.12, 0.22, length(f - (vec2(gHash(cell + 3.1), gHash(cell + 7.7)) - 0.5) * 0.5)))
                * step(0.93, h) * smoothstep(0.35, 0.6, gNoise(vP * 1.9 + 5.0)) * fade;
              vec3 petal = h > 0.965 ? vec3(0.95, 0.83, 0.32) : vec3(0.93, 0.92, 0.86);
              return mix(c, petal, dotMask * 0.85);
            }
            // Sheep camp (Medium/High): a sandy path of four short straight legs (points a.xy,
            // a.zw, b.xy, b.zw, c.xy), the same sand as the strips between tiles, a little trodden and darker,
            // with a ragged edge and slightly flattened grass along it.
            float segDist(vec2 p, vec2 a, vec2 b) {
              vec2 ab = b - a;
              float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
              return length(p - a - ab * t);
            }
            vec3 campGround(vec3 col, vec3 sandC, vec4 a, vec4 b, vec4 c) {
              if (dot(a.zw - a.xy, a.zw - a.xy) < 1e-6) return col;
              float d = min(min(segDist(vP, a.xy, a.zw), segDist(vP, a.zw, b.xy)),
                            min(segDist(vP, b.xy, b.zw), segDist(vP, b.zw, c.xy)));
              float dist = d - ${CAMP_PATH_WIDTH.toFixed(3)} + (gNoise(vP * 30.0) - 0.5) * 0.016;
              float mask = 1.0 - smoothstep(-0.006, 0.008, dist);
              vec3 pathC = sandC * (0.9 + 0.1 * gNoise(vP * 45.0 + 4.2));
              col *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.03, dist)) * (1.0 - mask);
              return mix(col, pathC, mask);
            }
            // Mountain floor (Medium/High): warm tan scree with grey rock slabs, darker gravel
            // streaks and a few patches of dry grass, under the 3D peaks.
            vec3 mountainFloor() {
              float n1 = gNoise(vP * 2.2 + 9.1);
              float n2 = gNoise(vP * 7.5 + 1.3);
              vec3 c = mix(${glslColor(MOUNTAIN_SCREE)}, ${glslColor(MOUNTAIN_ROCK)}, smoothstep(0.45, 0.75, n1));
              c *= 0.86 + 0.24 * n2;
              float streak = smoothstep(0.62, 0.85, gNoise(vec2(vP.x * 3.0 + vP.y * 1.2, vP.y * 9.0)));
              c = mix(c, c * 0.72, streak * 0.6);
              float grass = smoothstep(0.62, 0.8, gNoise(vP * 3.4 + 21.7));
              c = mix(c, grassAt(${glslColor(MOUNTAIN_GRASS)}), grass * 0.75);
              float px = length(fwidth(vP));
              c *= 1.0 + (gNoise(vP * 80.0) - 0.5) * 0.22 * (1.0 - smoothstep(0.25, 0.7, px * 80.0));
              return c;
            }
            vec4 terrainArt(int t, vec2 uv) {
              vec4 art = vec4(0.5, 0.5, 0.5, 1.0);
              ${ISLAND_TERRAINS.map((_, i) => `if (t == ${i}) art = texture2D(uTex${i}, uv);`).join("\n")}
              ${richForest ? `if (t == ${ISLAND_TERRAINS.indexOf("tile.forest")}) art = vec4(forestFloor(), art.a);` : ""}
              ${richForest ? `if (t == ${ISLAND_TERRAINS.indexOf("tile.pasture")}) art = vec4(meadowFloor(), art.a);` : ""}
              ${richForest ? `if (t == ${ISLAND_TERRAINS.indexOf("tile.mountains")}) art = vec4(mountainFloor(), art.a);` : ""}
              return art;
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
              ${richForest ? `if (uTerrain[i1] == ${ISLAND_TERRAINS.indexOf("tile.pasture")}) col = campGround(col, sandC, uPathA[i1], uPathB[i1], uPathC[i1]);` : ""}
              // Outside the coastal hexes a grass rim runs down toward the beach; the seams
              // between tiles (further inland on the shore scale) stay sand.
              float rim = smoothstep(${RIM_GRASS_START.toFixed(3)}, ${(RIM_GRASS_START + 0.06).toFixed(3)}, vShore)
                * (1.0 - smoothstep(${(RIM_GRASS_END - 0.08).toFixed(3)}, ${RIM_GRASS_END.toFixed(3)}, vShore));
              vec3 ground = mix(sandC, grassAt(${glslColor(GRASS_COLOR)}), rim);
              // Where no tile has art (outside every hexagon), the ground is sand (or rim grass).
              col = mix(ground, col, cover);
              col = mix(col, sandC, smoothstep(${COAST_START}, ${COAST_END}, vShore));
              diffuseColor.rgb *= col;
            }`,
          );
      },
      customProgramCacheKey: () =>
        `island-ground-${n}-${softTiles ? "soft" : "plain"}-${sandUrl ? "sand" : "nosand"}-${grassMap ? "g" : "-"}-${richForest ? "rf" : "-"}`,
    }),
    // Tiles and textures are fixed for a board and theme; remount on change via the key below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tiles, art, sand, softTiles, sandUrl, n, grassMap, richForest],
  );
  return (
    <mesh geometry={geometry} receiveShadow raycast={() => {}}>
      <meshStandardMaterial
        key={`${softTiles}-${sandUrl}-${urls.join()}-${grassMap ? "g" : "-"}-${richForest}`}
        roughness={1}
        metalness={0}
        {...material}
      />
    </mesh>
  );
}
