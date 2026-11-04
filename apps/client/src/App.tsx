import { Canvas } from "@react-three/fiber";
import { Hud } from "./hud/Hud.tsx";
import { useConnection } from "./net/useConnection.ts";
import { Scene } from "./scene/Scene.tsx";
import { ThemeProvider } from "./theme/index.ts";

// Wiring only. Owners: net/ store/ hud/ (client agent), theme/ scene/ (theme agent).
export function App() {
  useConnection();
  return (
    <ThemeProvider>
      <div className="app">
        <Canvas className="canvas" camera={{ position: [0, 9, 7], fov: 45 }} shadows>
          <Scene />
        </Canvas>
        <Hud />
      </div>
    </ThemeProvider>
  );
}
