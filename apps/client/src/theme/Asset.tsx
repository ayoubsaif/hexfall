// <Asset assetKey=... /> renders the themed GLB when mapped and loaded, otherwise the
// procedural fallback (unmapped, loading, or failed). Scene code never sees file paths.
import { useGLTF } from "@react-three/drei";
import { Component, type ReactNode, Suspense, useEffect, useMemo } from "react";
import { type Material, Mesh, type Object3D } from "three";
import { useTheme } from "./context.ts";
import { FALLBACKS } from "./fallbacks/index.ts";
import type { AssetKey } from "./keys.ts";
import type { Transform } from "./manifest.ts";
import { type AssetResolution, loadFailureMessage, resolveAsset } from "./resolve.ts";
import { instantiateModel } from "./tint.ts";

// Keys whose model failed in a theme, so later instances skip the load. Keyed by URL.
const failedUrls = new Set<string>();

export function useAsset(key: AssetKey): { resolution: AssetResolution; themeId: string } {
  const { theme } = useTheme();
  const resolution = resolveAsset(theme, key);
  if (resolution.kind === "model" && failedUrls.has(resolution.url)) {
    return { resolution: { kind: "fallback", key, reason: "failed" }, themeId: theme.id };
  }
  return { resolution, themeId: theme.id };
}

export interface AssetProps {
  assetKey: AssetKey;
  /** Owner color for player pieces; ignored by every other key. */
  playerColor?: string | undefined;
}

export function Asset({ assetKey, playerColor }: AssetProps) {
  const { resolution, themeId } = useAsset(assetKey);
  const Fallback = FALLBACKS[assetKey];
  const fallback = <Fallback playerColor={playerColor} />;
  if (resolution.kind === "fallback") return fallback;
  return (
    <ModelErrorBoundary
      key={resolution.url}
      fallback={fallback}
      onError={(error) => reportFailure(assetKey, themeId, resolution.url, error)}
    >
      <Suspense fallback={fallback}>
        <ThemedModel
          url={resolution.url}
          assetKey={assetKey}
          playerColor={playerColor}
          transform={resolution.transform}
        />
      </Suspense>
    </ModelErrorBoundary>
  );
}

function reportFailure(key: AssetKey, themeId: string, url: string, error: unknown): void {
  if (failedUrls.has(url)) return;
  failedUrls.add(url);
  console.warn(`[theme] ${loadFailureMessage(key, themeId, url, error)}`);
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

interface BoundaryProps {
  fallback: ReactNode;
  onError: (error: unknown) => void;
  children: ReactNode;
}

class ModelErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
