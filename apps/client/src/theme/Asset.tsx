// <Asset assetKey=... /> renders a key through the theme layer. Flat-kind keys (tiles,
// sea, token, harbors) depend on the board style: "flat" draws a flat shape, textured with
// the theme image when mapped and loaded; "3d" draws the procedural diorama (theme images
// are ignored). Model keys (pieces) draw the theme GLB in either style. Otherwise
// (unmapped, loading, or failed) the procedural fallback renders. Scene code never sees
// file paths.
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { use, useEffect, useLayoutEffect, useMemo } from "react";
import {
  type Material,
  Mesh,
  type Object3D,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from "three";
import { useTheme } from "./context.ts";
import { FALLBACKS } from "./fallbacks/index.ts";
import { type FlatAssetKey, FlatShape, isFlatAssetKey } from "./flat.tsx";
import type { AssetKey } from "./keys.ts";
import type { Transform } from "./manifest.ts";
import { type AssetResolution, resolveAsset } from "./resolve.ts";
import type { Projection } from "./relief.ts";
import { ThemedSlot, effectiveResolution } from "./slot.tsx";
import { type BoardStyle, useBoardStyle } from "./style.ts";
import { instantiateModel } from "./tint.ts";

/**
 * Resolves a key for the given board style. In the "3d" style flat-kind keys always use
 * the diorama fallback (theme images are for the flat style only).
 */
export function resolveForStyle(
  resolution: AssetResolution,
  key: AssetKey,
  style: BoardStyle,
): AssetResolution {
  if (style === "3d" && isFlatAssetKey(key)) return { kind: "fallback", key, reason: "unmapped" };
  return effectiveResolution(resolution);
}

export function useAsset(key: AssetKey): {
  resolution: AssetResolution;
  themeId: string;
  style: BoardStyle;
} {
  const { theme } = useTheme();
  const { style } = useBoardStyle();
  return {
    resolution: resolveForStyle(resolveAsset(theme, key), key, style),
    themeId: theme.id,
    style,
  };
}

export interface AssetProps {
  assetKey: AssetKey;
  /** Owner color for player pieces; ignored by every other key. */
  playerColor?: string | undefined;
}

export function Asset({ assetKey, playerColor }: AssetProps) {
  const { resolution, themeId, style } = useAsset(assetKey);
  const Fallback = FALLBACKS[style][assetKey];
  const fallback = <Fallback playerColor={playerColor} />;
  if (resolution.kind === "fallback") return fallback;
  return (
    <ThemedSlot
      assetKey={assetKey}
      themeId={themeId}
      fileKind={resolution.kind}
      url={resolution.url}
      fallback={fallback}
    >
      {resolution.kind === "image" ? (
        // The manifest only accepts images for flat keys, so this always holds.
        isFlatAssetKey(assetKey) && (
          <FlatAsset url={resolution.url} assetKey={assetKey} projection={resolution.projection} />
        )
      ) : (
        <ThemedModel
          url={resolution.url}
          assetKey={assetKey}
          playerColor={playerColor}
          transform={resolution.transform}
        />
      )}
    </ThemedSlot>
  );
}

// One load per image URL, shared by every tile that uses it. A rejected promise makes
// `use()` throw into the ThemedSlot error boundary, which shows the fallback and warns.
const textures = new Map<string, Promise<Texture>>();
const textureLoader = new TextureLoader();

function loadTexture(url: string): Promise<Texture> {
  let p = textures.get(url);
  if (!p) {
    // The loader rejects with a DOM Event; turn it into a readable Error for the warning.
    p = textureLoader.loadAsync(url).catch((cause: unknown) => {
      throw cause instanceof Error ? cause : new Error("image not found or not decodable");
    });
    p.catch(() => undefined); // handled by the error boundary; avoid an unhandled rejection
    textures.set(url, p);
  }
  return p;
}

/** A flat key textured with its theme image: same shape as the fallback, plus a map. */
export function FlatAsset({
  url,
  assetKey,
  projection,
}: {
  url: string;
  assetKey: FlatAssetKey;
  projection: Projection;
}) {
  const texture = use(loadTexture(url));
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  useLayoutEffect(() => {
    if (texture.colorSpace !== SRGBColorSpace || texture.anisotropy !== maxAnisotropy) {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;
      texture.needsUpdate = true;
    }
  }, [texture, maxAnisotropy]);
  return <FlatShape assetKey={assetKey} color="#ffffff" map={texture} projection={projection} />;
}

function ThemedModel({
  url,
  assetKey,
  playerColor,
  transform,
}: {
  url: string;
  assetKey: AssetKey;
  playerColor: string | undefined;
  transform: Transform | undefined;
}) {
  const gltf = useGLTF(url);
  const object = useMemo(
    () => instantiateModel(gltf.scene, assetKey, playerColor),
    [gltf.scene, assetKey, playerColor],
  );
  useEffect(() => () => disposeClonedMaterials(object, gltf.scene), [object, gltf.scene]);
  // Overrides go on top of the authored model; absent overrides mean identity.
  return transform ? (
    <group position={transform.offset} rotation={transform.rotation} scale={transform.scale}>
      <primitive object={object} />
    </group>
  ) : (
    <primitive object={object} />
  );
}

function collectMaterials(root: Object3D): Set<Material> {
  const out = new Set<Material>();
  root.traverse((node) => {
    if (node instanceof Mesh) {
      for (const m of Array.isArray(node.material) ? node.material : [node.material])
        out.add(m as Material);
    }
  });
  return out;
}

/** Disposes only per-instance material clones, never the shared cached originals. */
function disposeClonedMaterials(instance: Object3D, source: Object3D): void {
  const shared = collectMaterials(source);
  for (const m of collectMaterials(instance)) if (!shared.has(m)) m.dispose();
}
