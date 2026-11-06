import { Canvas } from "@react-three/fiber";
import { useEffect } from "react";
import { Hud } from "./hud/Hud.tsx";
import { useConnection } from "./net/useConnection.ts";
import { Scene } from "./scene/Scene.tsx";
import { bindUiToGame } from "./store/ui.ts";
import { Splash } from "./hud/Splash.tsx";
import { ThemeProvider, useTheme } from "./theme/index.ts";

/** Parchment splash until the theme manifest resolves; it never delays a ready app. */
function SplashGate() {
  return useTheme().status === "loading" ? <Splash /> : null;
}

// Wiring only. net/ runs the session (server -> stores); scene/ draws the board and picks;
// hud/ is the DOM overlay; theme/ resolves assets. The ui store drops stale intent on
// every phase or turn change.
export function App() {
  useConnection();
  useEffect(() => bindUiToGame(), []);
  return (
    <ThemeProvider>
      <div className="app">
        <Canvas
          className="canvas"
          camera={{ position: [0, 12, 8], fov: 45 }}
          shadows
          gl={{ alpha: true }}
        >
          <Scene />
        </Canvas>
        <Hud />
        <SplashGate />
      </div>
    </ThemeProvider>
  );
}
