// The board scene: lighting, sea background, the board (preview or live game), pieces,
// pick targets, the board dice and camera controls.
import { beginnerBoard } from "@hexfall/engine/geometry";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, type Object3D, TOUCH, type Vector3 } from "three";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CameraRig } from "./CameraRig.tsx";
import { MAX_POLAR, panCorrection } from "./cameraLimits.ts";
import { QUALITY, useGraphicsQuality } from "./graphicsQuality.ts";
import { Water } from "./Water.tsx";
import { boardLayout } from "./layout.ts";
import { resolveCursor, setCameraDragging, useCursorStore } from "../store/cursor.ts";
import { useGameStore } from "../store/game.ts";
import { ZOOM_MIN } from "../store/view.ts";
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
  const quality = QUALITY[useGraphicsQuality()];
  useCanvasCursor();
  useGestures();
  // Isometric tile art is painted for one view: start there and allow only a small turn.
  const relief = useLandRelief();
  const fit = useFitCamera(relief.isometric ? (ISO_ELEVATION_DEG * Math.PI) / 180 : undefined);
  useZoomBridge(fit);
  const turn = relief.isometric ? ISO_AZIMUTH_LIMIT : Infinity;
  // Land hex centers do not depend on the terrain shuffle, so the preview board gives them.
  const landCenters = useMemo(() => boardLayout(beginnerBoard()).tiles.map((t) => t.position), []);
  const harborCenters = useMemo(
    () => boardLayout(beginnerBoard()).harbors.map((h) => h.position),
    [],
  );
  const tableY = relief.seaLevel - 0.02;
  return (
    <>
      <hemisphereLight args={["#fff6e5", "#4a6a7a", 0.8]} />
      <directionalLight
        key={quality.shadowSize}
        position={[6, 12, 4]}
        intensity={1.6}
        castShadow={quality.shadows}
        shadow-mapSize={[quality.shadowSize, quality.shadowSize]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Water land={landCenters} harbors={harborCenters} y={tableY} />

      <GameBoard />

      <CameraRig
        distance={fit}
        {...(relief.isometric ? { elevation: (ISO_ELEVATION_DEG * Math.PI) / 180 } : {})}
      />
      <OrbitControls
        makeDefault
        enableZoom={false}
        enablePan={false}
        mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        // One finger orbits the centered board; two fingers are pinch / twist / tilt,
        // handled in useGestures (Google Maps style).
        screenSpacePanning={false}
        touches={{ ONE: TOUCH.ROTATE }}
        onStart={() => setCameraDragging(true)}
        onEnd={() => setCameraDragging(false)}
        onChange={(e) => {
          // Always pin the orbit target to the center, including after hot reload or presets.
          const c = e?.target as { target: Vector3; object: Object3D } | undefined;
          if (!c) return;
          const fix = panCorrection(c.target);
          if (fix.lengthSq() > 1e-8) {
            c.target.add(fix);
            c.object.position.add(fix);
          }
        }}
        target={[0, 0, 0]}
        maxPolarAngle={MAX_POLAR}
        minAzimuthAngle={-turn}
        maxAzimuthAngle={turn}
        minDistance={fit * 0.45}
        maxDistance={(fit * 100) / ZOOM_MIN}
      />
    </>
  );
}
