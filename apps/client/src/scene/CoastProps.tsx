// Draws the coast dressing (coastScatter.ts) with one instanced mesh per key, variant and part,
// so ~160 props cost a few dozen draw calls. Each key uses the theme GLB (root meshes named
// "<key>_variant_<n>") or, when unmapped, loading or failed, the procedural kit. Props never take
// part in picking.
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  type InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import {
  COAST_KEYS,
  type CoastKey,
  type PropVariant,
  coastFallbackVariants,
  useTheme,
} from "../theme/index.ts";
import { resolveAsset } from "../theme/resolve.ts";
import { ThemedSlot, effectiveResolution } from "../theme/slot.tsx";
import type { PropInstance } from "./coastScatter.ts";

const DRACO_DECODERS = "/draco/";
const VARIANT_NAME = /variant_(\d+)$/;

/** Variants of a loaded kit GLB, sorted by index, each mesh baked into its root's frame. */
export function variantsFromScene(
  scene: Object3D,
  materialFor: (m: Material) => Material = (m) => m,
): PropVariant[] {
  scene.updateMatrixWorld(true);
  const found: { index: number; parts: PropVariant }[] = [];
  for (const root of scene.children) {
    const m = VARIANT_NAME.exec(root.name);
    if (!m) continue;
    const toRoot = new Matrix4().copy(root.matrixWorld).invert();
    const parts: { geometry: Mesh["geometry"]; material: Material | Material[] }[] = [];
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const geometry = node.geometry.clone();
      geometry.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, node.matrixWorld));
      const material = node.material as Material | Material[];
      parts.push({
        geometry,
        material: Array.isArray(material) ? material.map(materialFor) : materialFor(material),
      });
    });
    found.push({ index: Number(m[1]), parts });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.parts);
}

const UP = new Vector3(0, 1, 0);
type MaterialFor = (m: Material) => Material;
const SAME: MaterialFor = (m) => m;

function InstancedPart({
  part,
  items,
  baseY,
  shadows,
}: {
  part: PropVariant[number];
  items: readonly PropInstance[];
  baseY: (p: PropInstance) => number;
  shadows: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4(),
      q = new Quaternion(),
      s = new Vector3(),
      p = new Vector3();
    items.forEach((item, i) => {
      q.setFromAxisAngle(UP, item.yaw);
      s.setScalar(item.scale);
      p.set(item.x, baseY(item), item.z);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, baseY]);
  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, part.material, items.length]}
      castShadow={shadows}
      receiveShadow
      raycast={() => {}}
    />
  );
}

function KitInstances({
  variants,
  items,
  baseY,
  shadows,
}: {
  variants: readonly PropVariant[];
  items: readonly PropInstance[];
  baseY: (p: PropInstance) => number;
  shadows: boolean;
}) {
  const groups = useMemo(
    () => variants.map((_, v) => items.filter((item) => item.variant % variants.length === v)),
    [variants, items],
  );
  if (!variants.length) return null;
  return (
    <>
      {variants.map((parts, v) =>
        groups[v]!.length
          ? parts.map((part, k) => (
              <InstancedPart
                key={`${v}-${k}-${groups[v]!.length}`}
                part={part}
                items={groups[v]!}
                baseY={baseY}
                shadows={shadows}
              />
            ))
          : null,
      )}
    </>
  );
}

function GltfKit({
  url,
  materialFor,
  ...rest
}: { url: string; materialFor: MaterialFor } & Omit<
  Parameters<typeof KitInstances>[0],
  "variants"
>) {
  const gltf = useGLTF(url, DRACO_DECODERS);
  const variants = useMemo(
    () => variantsFromScene(gltf.scene, materialFor),
    [gltf.scene, materialFor],
  );
  // A GLB without any variant meshes falls back to the procedural kit.
  return <KitInstances variants={variants} {...rest} />;
}

function KeyProps({
  assetKey,
  items,
  baseY,
  shadows,
  materialFor,
}: {
  assetKey: CoastKey;
  items: readonly PropInstance[];
  baseY: (p: PropInstance) => number;
  shadows: boolean;
  materialFor: MaterialFor;
}) {
  const { theme } = useTheme();
  const resolution = effectiveResolution(resolveAsset(theme, assetKey));
  const fallback = (
    <KitInstances
      variants={coastFallbackVariants(assetKey)}
      items={items}
      baseY={baseY}
      shadows={shadows}
    />
  );
  if (resolution.kind !== "model") return fallback;
  return (
    <ThemedSlot
      assetKey={assetKey}
      themeId={theme.id}
      fileKind="model"
      url={resolution.url}
      fallback={fallback}
    >
      <GltfKit
        url={resolution.url}
        items={items}
        baseY={baseY}
        shadows={shadows}
        materialFor={materialFor}
      />
    </ThemedSlot>
  );
}

export function CoastProps({
  props,
  baseY,
  shadows = true,
  materialFor = SAME,
}: {
  props: readonly PropInstance[];
  /** World height of a prop's base. */
  baseY: (p: PropInstance) => number;
  shadows?: boolean;
  /** Swaps kit materials (for example the textured rock); identity by default. */
  materialFor?: MaterialFor;
}) {
  const byKey = useMemo(
    () => COAST_KEYS.map((key) => [key, props.filter((p) => p.key === key)] as const),
    [props],
  );
  return (
    <group>
      {byKey.map(([key, items]) =>
        items.length ? (
          <KeyProps
            key={key}
            assetKey={key}
            items={items}
            baseY={baseY}
            shadows={shadows}
            materialFor={materialFor}
          />
        ) : null,
      )}
    </group>
  );
}
