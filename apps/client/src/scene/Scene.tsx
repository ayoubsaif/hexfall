// The board scene: lighting, sea background, the board (preview or live game), pieces,
// pick targets, the board dice and camera controls.
import { beginnerBoard } from "@hexfall/engine/geometry";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, TOUCH } from "three";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CameraRig } from "./CameraRig.tsx";
import { Water } from "./Water.tsx";
import { boardLayout } from "./layout.ts";
import { resolveCursor, setCameraDragging, useCursorStore } from "../store/cursor.ts";
import { useGameStore } from "../store/game.ts";
import { ISO_ELEVATION_DEG, useLandRelief } from "../theme/index.ts";
import { BoardView } from "./BoardView.tsx";
import { BoardDice } from "./dice/BoardDice.tsx";
import { producingHexes } from "./motion.ts";
import { Pieces } from "./Pieces.tsx";
import { Targets } from "./Targets.tsx";
import { useFitCamera } from "./useFitCamera.ts";
import { useGestures } from "./useGestures.ts";
import { useZoomBridge } from "./useZoomBridge.ts";

/** The live game when the server delivered one, else the beginner preview (board-view "Preview board"). */
function GameBoard() {
  // Preview until the server delivers a game. Built inside the component so that merely
  // importing Scene never runs board code.
  const previewBoard = useMemo(() => beginnerBoard(), []);
  const view = useGameStore((s) => s.view);
  const version = useGameStore((s) => s.version);
  const source = useGameStore((s) => s.source);
  const lastEvents = useGameStore((s) => s.lastEvents);
  const glowHexes = useMemo(
    () => (view ? producingHexes(view.board, view.robber, lastEvents, source) : []),
    [view, lastEvents, source],
  );
  if (!view) return <BoardView board={previewBoard} />;
  return (
    <>
      <BoardView
        board={view.board}
        robberHex={view.robber}
        glowHexes={glowHexes}
        glowKey={version}
        source={source}
      />
      <Pieces view={view} />
      <Targets />
      {/* Land tops are at y = 0 in flat and raised relief (raised lowers the sea). */}
      <BoardDice floorY={0} />
    </>
  );
}

/** Max camera turn left/right from the art's view when tiles are isometric (radians). */
const ISO_AZIMUTH_LIMIT = (50 * Math.PI) / 180;

/** Owns the canvas cursor: grab / grabbing / pointer (store/cursor.ts). */
function useCanvasCursor() {
  const el = useThree((s) => s.gl.domElement);
  const cursor = useCursorStore(resolveCursor);
  useEffect(() => {
    el.style.cursor = cursor;
  }, [el, cursor]);
  useEffect(
    () => () => {
      el.style.cursor = "";
      setCameraDragging(false);
    },
    [el],
  );
}

export function Scene() {
  useCanvasCursor();
  useGestures();
  // Isometric tile art is painted for one view: start there and allow only a small turn.
  const relief = useLandRelief();
  const fit = useFitCamera(relief.isometric ? (ISO_ELEVATION_DEG * Math.PI) / 180 : undefined);
  useZoomBridge(fit);
  const turn = relief.isometric ? ISO_AZIMUTH_LIMIT : Infinity;
  // Land hex centers do not depend on the terrain shuffle, so the preview board gives them.
  const landCenters = useMemo(
    () => boardLayout(beginnerBoard()).tiles.map((t) => t.position),
    [],
  );
  const tableY = relief.seaLevel - 0.02;
  return (
    <>
      <hemisphereLight args={["#fff6e5", "#4a6a7a", 0.8]} />
      <directionalLight
        position={[6, 12, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Water land={landCenters} y={tableY} />

      <GameBoard />

      <CameraRig
        distance={fit}
        {...(relief.isometric ? { elevation: (ISO_ELEVATION_DEG * Math.PI) / 180 } : {})}
      />
      <OrbitControls
        makeDefault
        enableZoom={false}
        mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
        onStart={() => setCameraDragging(true)}
        onEnd={() => setCameraDragging(false)}
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minAzimuthAngle={-turn}
        maxAzimuthAngle={turn}
        minDistance={fit * 0.45}
        maxDistance={fit * 1.5}
      />
    </>
  );
}
