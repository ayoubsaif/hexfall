// Shore surfaces (specs/coast-dressing "Shore surfaces"): CC0 Poly Haven maps for the beach (sand
// with a grass band toward the land) and for the kit rocks (mossy rock, projected triplanar since
// the kit models carry no UVs). Every map is optional: until it loads, or if it fails, the
// surface keeps a plain colour. Maps are divided by their mean colour, so they add detail around
// the surface's own colour instead of darkening it.
import { useEffect, useState } from "react";
import {
  Color,
  type Material,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from "three";

export const COAST_TEXTURES = {
  rock: "/textures/coast/mossy-rock-color.webp",
  grass: "/textures/coast/grass-color.webp",
  sand: "/textures/coast/sand-color.webp",
} as const;
export type CoastTextureName = keyof typeof COAST_TEXTURES;
export type CoastTextures = Partial<Record<CoastTextureName, Texture>>;

/** Mean linear colour of each map (measured from the WebPs). */
export const TEXTURE_MEAN: Record<CoastTextureName, readonly [number, number, number]> = {
  rock: [0.15, 0.147, 0.095],
  grass: [0.168, 0.12, 0.017],
  sand: [0.223, 0.171, 0.107],
};
/** Detail strength: 0 = plain colour, 1 = the map's full contrast. */
export const DETAIL = 0.75;

/** Plain surface colours (also the fallback when a map is missing). */
export const GRASS_COLOR = "#7d9e45";
export const SAND_COLOR = "#d7bd85";

const meanGlsl = (name: CoastTextureName) =>
  `vec3(${TEXTURE_MEAN[name].map((v) => v.toFixed(3)).join(", ")})`;
/** GLSL: the map's detail around 1.0 (sampler expression `sample`, mean of map `name`). */
const detail = (sample: string, name: CoastTextureName) =>
  `mix(vec3(1.0), ${sample} / ${meanGlsl(name)}, ${DETAIL.toFixed(2)})`;

/** Loads the coast maps; each entry appears when it has loaded (and never if it fails). */
export function useCoastTextures(): CoastTextures {
  const [maps, setMaps] = useState<CoastTextures>({});
  useEffect(() => {
    let active = true;
    const owned: Texture[] = [];
    const loader = new TextureLoader();
    for (const [name, url] of Object.entries(COAST_TEXTURES) as [CoastTextureName, string][]) {
      loader.load(
        url,
        (texture) => {
          if (!active) return texture.dispose();
          texture.wrapS = texture.wrapT = RepeatWrapping;
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 4;
          owned.push(texture);
          setMaps((m) => ({ ...m, [name]: texture }));
        },
        undefined,
        () => {
          /* Plain colour fallback. */
        },
      );
    }
    return () => {
      active = false;
      owned.forEach((t) => t.dispose());
    };
  }, []);
  return maps;
}

/**
 * Beach material: vertex-coloured sand (wet darkening) that blends into grass where the
 * `grass` vertex attribute is 1. Either map may be absent.
 */
export function beachMaterial(maps: CoastTextures): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: SAND_COLOR, vertexColors: true, roughness: 0.9 });
  const sandMap = maps.sand ?? null;
  const grassMap = maps.grass ?? null;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGrass = { value: grassMap };
    shader.uniforms.uSand = { value: sandMap };
    shader.uniforms.uGrassColor = { value: new Color(GRASS_COLOR) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float grass;\nvarying float vGrass;\nvarying vec2 vGrassUv;",
      )
      .replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\nvGrass = grass;\nvGrassUv = uv * 1.6;",
      );
    const sand = sandMap
      ? `diffuseColor.rgb *= ${detail("texture2D(uSand, vGrassUv * 0.8).rgb", "sand")};`
      : "";
    const grass = grassMap ? ` * ${detail("texture2D(uGrass, vGrassUv).rgb", "grass")}` : "";
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "varying float vGrass;",
          "varying vec2 vGrassUv;",
          "uniform vec3 uGrassColor;",
          "uniform sampler2D uGrass;",
          "uniform sampler2D uSand;",
        ].join("\n"),
      )
      .replace(
        "#include <map_fragment>",
        [
          "#include <map_fragment>",
          sand,
          `vec3 grassRgb = uGrassColor${grass};`,
          "diffuseColor.rgb = mix(diffuseColor.rgb, grassRgb, clamp(vGrass, 0.0, 1.0));",
        ].join("\n"),
      );
  };
  m.customProgramCacheKey = () => `beach-${grassMap ? "g" : "-"}${sandMap ? "s" : "-"}`;
  return m;
}

/**
 * A kit material with a triplanar map in the mesh's own space (so it rotates with each
 * instance) adding detail to the original colour. Returns the material unchanged without a map.
 */
export function triplanar(
  base: Material,
  map: Texture | undefined,
  mean: CoastTextureName,
  scale = 9,
): Material {
  if (!map || !(base instanceof MeshStandardMaterial)) return base;
  const m = base.clone();
  m.flatShading = true;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTri = { value: map };
    shader.uniforms.uTriScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvTriPos = position;\nvTriNormal = normal;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "varying vec3 vTriPos;",
          "varying vec3 vTriNormal;",
          "uniform sampler2D uTri;",
          "uniform float uTriScale;",
        ].join("\n"),
      )
      .replace(
        "#include <map_fragment>",
        [
          "#include <map_fragment>",
          "vec3 tw = pow(abs(normalize(vTriNormal)), vec3(4.0));",
          "tw /= (tw.x + tw.y + tw.z);",
          "vec3 tp = vTriPos * uTriScale;",
          "vec3 tri = texture2D(uTri, tp.yz).rgb * tw.x + texture2D(uTri, tp.xz).rgb * tw.y",
          "         + texture2D(uTri, tp.xy).rgb * tw.z;",
          `diffuseColor.rgb *= ${detail("tri", mean)};`,
        ].join("\n"),
      );
  };
  m.customProgramCacheKey = () => `tri-${base.name}-${mean}-${scale}`;
  return m;
}

/** Swaps the kit's named rock and moss materials for textured ones when the maps are loaded. */
export function coastMaterialFor(maps: CoastTextures) {
  return (material: Material): Material => {
    const name = material.name.split(".")[0];
    if (name === "Rock" || name === "RockDark") return triplanar(material, maps.rock, "rock");
    if (name === "Moss") return triplanar(material, maps.grass, "grass", 12);
    return material;
  };
}
