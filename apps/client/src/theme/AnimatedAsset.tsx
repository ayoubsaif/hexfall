// <AnimatedAsset assetKey=... /> renders a model key whose GLB carries a skinned animation
// (the sea gull's flap). Each instance gets its own skeleton clone and plays every clip on
// loop, started `timeOffset` seconds in so several copies don't move in step. While the GLB
// loads, after a load failure, or when the key is unmapped, the key's procedural fallback
// renders, exactly as for <Asset>.
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AnimationMixer, LoopRepeat } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useAsset } from "./Asset.tsx";
import { FALLBACKS } from "./fallbacks/index.ts";
import type { AssetKey } from "./keys.ts";
import type { Transform } from "./manifest.ts";
import { ThemedSlot } from "./slot.tsx";

const DRACO_DECODERS = "/draco/";
const noRaycast = () => undefined;

export interface AnimatedAssetProps {
  assetKey: AssetKey;
  /** Seconds into the clip at which this instance starts. */
  timeOffset?: number;
}

export function AnimatedAsset({ assetKey, timeOffset = 0 }: AnimatedAssetProps) {
  const { resolution, themeId } = useAsset(assetKey);
  const Fallback = FALLBACKS[assetKey];
  const fallback = <Fallback />;
  if (resolution.kind !== "model") return fallback;
  return (
    <ThemedSlot
      assetKey={assetKey}
      themeId={themeId}
      fileKind="model"
      url={resolution.url}
      fallback={fallback}
    >
      <AnimatedModel url={resolution.url} transform={resolution.transform} timeOffset={timeOffset} />
    </ThemedSlot>
  );
}

function AnimatedModel({
  url,
  transform,
  timeOffset,
}: {
  url: string;
  transform: Transform | undefined;
  timeOffset: number;
}) {
  const gltf = useGLTF(url, DRACO_DECODERS);
  // SkeletonUtils keeps each copy's bones bound to its own skinned mesh.
  const object = useMemo(() => {
    const copy = cloneSkinned(gltf.scene);
    copy.traverse((node) => {
      node.raycast = noRaycast;
    });
    return copy;
  }, [gltf.scene]);
  const mixer = useMemo(() => new AnimationMixer(object), [object]);
  useEffect(() => {
    for (const clip of gltf.animations) mixer.clipAction(clip).setLoop(LoopRepeat, Infinity).play();
    mixer.setTime(timeOffset);
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(object);
    };
  }, [mixer, gltf.animations, object, timeOffset]);
  useFrame((_, delta) => mixer.update(delta));
  return transform ? (
    <group position={transform.offset} rotation={transform.rotation} scale={transform.scale}>
      <primitive object={object} />
    </group>
  ) : (
    <primitive object={object} />
  );
}
