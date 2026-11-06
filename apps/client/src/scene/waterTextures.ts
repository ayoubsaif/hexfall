import type { ShaderMaterial } from "three";
// Loads the optional sea and coast textures (specs/sea-coast-rendering, "Procedural fallback").
// A slot that is not declared, still loading, or failed to load stays undefined, and the water
// shader then uses its procedural look for that layer. Never throws.
import { RepeatWrapping, type Texture, TextureLoader, SRGBColorSpace } from "three";
import type { WaterUrls } from "../theme/index.ts";

export const WATER_SLOTS = ["caustics", "sand"] as const;
export type WaterSlot = (typeof WATER_SLOTS)[number];
export type WaterTextures = Partial<Record<WaterSlot, Texture>>;

/** Loads one image into a Texture; injected so tests need no image decoding. */
export type TextureFetcher = (url: string) => Promise<Texture>;

export const fetchTexture: TextureFetcher = (url) =>
  new TextureLoader().loadAsync(url).then((tex) => {
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });

/**
 * Starts loading every declared slot. `onSlot` fires once per slot that loads; a failing slot
 * is reported through `onError` and skipped. Returns a cancel function (late results are
 * dropped and their textures disposed).
 */
export function loadWaterTextures(
  urls: WaterUrls,
  onSlot: (slot: WaterSlot, texture: Texture) => void,
  onError: (slot: WaterSlot, url: string, error: unknown) => void = () => {},
  fetcher: TextureFetcher = fetchTexture,
): () => void {
  let alive = true;
  for (const slot of WATER_SLOTS) {
    const url = urls[slot];
    if (!url) continue;
    let request: Promise<Texture>;
    try {
      request = fetcher(url);
    } catch (error) {
      onError(slot, url, error);
      continue;
    }
    request.then(
      (texture) => {
        if (alive) onSlot(slot, texture);
        else texture.dispose();
      },
      (error: unknown) => {
        if (alive) onError(slot, url, error);
      },
    );
  }
  return () => {
    alive = false;
  };
}

/** Low-capability devices get the cheaper shader path (one caustic sample, fewer octaves). */
export function isLowPower(
  nav: Pick<Navigator, "hardwareConcurrency"> | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
  dpr: number = typeof window === "undefined" ? 1 : window.devicePixelRatio,
  shortSide: number = typeof window === "undefined"
    ? 1024
    : Math.min(window.innerWidth, window.innerHeight),
): boolean {
  const cores = nav?.hardwareConcurrency ?? 8;
  return cores <= 4 || (dpr > 2 && shortSide < 700);
}

/** Shader time: frozen under reduced motion so crests, caustics and tide stand still. */
export const STILL_WATER_TIME = 1.2;
export function waterTime(reduced: boolean, elapsed: number): number {
  return reduced ? STILL_WATER_TIME : elapsed;
}

/** R3F copies uniform entries during prop application. Update the live material's
 * entries, preserving its dictionary reference, after time/texture/simulation changes. */
export function syncWaterUniforms(
  material: ShaderMaterial | null,
  values: Record<string, { value: unknown }>,
): void {
  if (!material) return;
  for (const [name, uniform] of Object.entries(values)) {
    if (material.uniforms[name]) material.uniforms[name].value = uniform.value;
  }
}
