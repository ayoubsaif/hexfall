import { lazy, Suspense, useEffect } from "react";
import { useButtonLight } from "./hooks/use-button-light.ts";
import { Hud } from "./hud/Hud.tsx";
import { MapSketch } from "./hud/MapSketch.tsx";
import { useConnection } from "./net/useConnection.ts";
import { boardVisible, useRoomStore } from "./store/room.ts";
import { useSceneReady } from "./store/sceneReady.ts";
import { bindUiToGame } from "./store/ui.ts";
import { Splash } from "./hud/Splash.tsx";
import { ThemeProvider, useTheme } from "./theme/index.ts";

const BoardCanvas = lazy(() => import("./scene/BoardCanvas.tsx"));

/** Parchment splash until the theme manifest resolves and the board has loaded its assets. */
function SplashGate() {
  const themeLoading = useTheme().status === "loading";
  const { ready, progress } = useSceneReady();
  return themeLoading || !ready ? (
    <Splash {...(progress === undefined ? {} : { progress })} />
  ) : null;
}

// Wiring only. net/ runs the session (server -> stores); scene/ draws the board and picks;
// hud/ is the DOM overlay; theme/ resolves assets. The ui store drops stale intent on
// every phase or turn change.
export function App() {
  useConnection();
  useButtonLight();
  const inRoom = useRoomStore((s) => s.room !== null);
  // The start screen and the lobby keep the light map sketch; the 3D board loads on Start.
  const showBoard = useRoomStore(boardVisible);
  useEffect(() => bindUiToGame(), []);
  return (
    <ThemeProvider>
      <div className="app" data-entry={!inRoom || undefined}>
        {!showBoard && <MapSketch />}
        {showBoard && (
          <Suspense fallback={<Splash />}>
            <BoardCanvas />
          </Suspense>
        )}
        <Hud />
        {showBoard && <SplashGate />}
      </div>
    </ThemeProvider>
  );
}
