import { Canvas } from "@react-three/fiber";
import { AdaptiveGraphics } from "./AdaptiveGraphics.tsx";
import { QUALITY, useGraphicsQuality } from "./graphicsQuality.ts";
import { ReadyProbe } from "./ReadyProbe.tsx";
import { Scene } from "./Scene.tsx";

/** Load the 3D board only after entering a room; the welcome needs no WebGL context. */
export default function BoardCanvas() {
  const quality = QUALITY[useGraphicsQuality()];
  return (
    <Canvas
      className="canvas"
      camera={{ position: [0, 12, 8], fov: 45 }}
      shadows={quality.shadows}
      dpr={[1, quality.dpr]}
      gl={{ alpha: true }}
    >
      <AdaptiveGraphics />
      <ReadyProbe />
      <Scene />
    </Canvas>
  );
}
