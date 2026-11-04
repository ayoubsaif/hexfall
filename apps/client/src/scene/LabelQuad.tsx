import type { Texture } from "three";
import { Y_LABEL } from "./canvasLabel.ts";

/** A flat, unlit, transparent quad lying on the board plane, image top toward −Z. */
export function LabelQuad({
  texture,
  size,
  y = Y_LABEL,
}: {
  texture: Texture;
  size: number;
  /** Height above the board plane; the 3D token top sits higher than the flat one. */
  y?: number;
}) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        toneMapped={false}
      />
    </mesh>
  );
}
