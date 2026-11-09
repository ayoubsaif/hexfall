// The board scene: lighting, sea background, the board (preview or live game), pieces,
// pick targets, the board dice and camera controls.
import {
  LARGE_TOPOLOGY,
  beginnerBoard,
  hexCenter,
  topologyFor,
  type Board,
  type BoardLayout,
  type Terrain,
} from "@hexfall/engine/geometry";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, type Object3D, TOUCH, type Vector3 } from "three";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CameraRig } from "./CameraRig.tsx";
import { MAX_POLAR, panCorrection } from "./cameraLimits.ts";
import { QUALITY, useGraphicsQuality } from "./graphicsQuality.ts";
import { PostFx } from "./PostFx.tsx";
import { usePrefsStore } from "../store/prefs.ts";
import { Water } from "./Water.tsx";
import { resolveCursor, setCameraDragging, useCursorStore } from "../store/cursor.ts";
import { useGameStore } from "../store/game.ts";
import { DEFAULT_ZOOM, ZOOM_MIN } from "../store/view.ts";
import { ISO_ELEVATION_DEG, useLandRelief } from "../theme/index.ts";
import { BoardView } from "./BoardView.tsx";
import { BoardDice } from "./dice/BoardDice.tsx";
import { producingHexes } from "./motion.ts";
import { Pieces } from "./Pieces.tsx";
import { SeaBirds } from "./SeaBirds.tsx";
import { Targets } from "./Targets.tsx";
import { useFitCamera } from "./useFitCamera.ts";
import { useGestures } from "./useGestures.ts";
import { useZoomBridge } from "./useZoomBridge.ts";

let preview: Board | null = null;
/** The beginner preview board, built on first use so that merely importing Scene runs no board code. */
function previewBoard(): Board {
  return (preview ??= devPreviewLayout() === "large" ? devLargeBoard() : beginnerBoard());
}

/** Dev only: `?previewLayout=large` previews the 5–6 player island, to check its framing and coast. */
function devPreviewLayout(): BoardLayout {
  if (!import.meta.env.DEV || typeof location === "undefined") return "standard";
  return new URLSearchParams(location.search).get("previewLayout") === "large"
    ? "large"
    : "standard";
}

/** A fixed large board for the dev preview (component counts of the large board, no randomness). */
function devLargeBoard(): Board {
  const terrains: Terrain[] = ["forest", "pasture", "fields", "hills", "mountains"];
  const tokens = [
    5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12,
  ];
  let t = 0;
  const hexes = LARGE_TOPOLOGY.hexes.map((h) =>
    h.id === 14 || h.id === 15
      ? { terrain: "desert" as const, token: null }
      : { terrain: terrains[h.id % 5]!, token: tokens[t++]! },
  );
  return {
    layout: "large",
    hexes,
    harbors: [
      "generic",
      "grain",
      "ore",
      "generic",
      "wool",
      "generic",
      "generic",
      "brick",
      "lumber",
      "wool",
      "generic",
    ],
    robber: 14,
  };
}

/** The live game when the server delivered one, else the beginner preview (board-view "Preview board"). */
function GameBoard() {
  const view = useGameStore((s) => s.view);
  const version = useGameStore((s) => s.version);
  const source = useGameStore((s) => s.source);
  const lastEvents = useGameStore((s) => s.lastEvents);
  const glowHexes = useMemo(
    () => (view ? producingHexes(view.board, view.robber, lastEvents, source) : []),
    [view, lastEvents, source],
  );
  if (!view) return <BoardView board={previewBoard()} />;
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
  const tier = useGraphicsQuality();
  const quality = QUALITY[tier];
  const screenFilters = usePrefsStore((s) => s.screenFilters);
  useCanvasCursor();
  useGestures();
  // Isometric tile art is painted for one view: start there and allow only a small turn.
  const relief = useLandRelief();
  // The board shown (live game or preview) decides the island's outline: standard or large.
  const layoutKind = useGameStore((s) =>
    s.view ? (s.view.board.layout ?? "standard") : devPreviewLayout(),
  );
  const topology = useMemo(() => topologyFor(layoutKind), [layoutKind]);
  const fit = useFitCamera(
    relief.isometric ? (ISO_ELEVATION_DEG * Math.PI) / 180 : undefined,
    topology,
  );
  useZoomBridge(fit);
  const turn = relief.isometric ? ISO_AZIMUTH_LIMIT : Infinity;
  // Land hex centers depend only on the layout, not on the terrain shuffle.
  const landCenters = useMemo(
    () => topology.hexes.map((h) => hexCenter(h.id, topology)),
    [topology],
  );
  const tableY = relief.seaLevel - 0.02;
  return (
    <>
      {/* Warm, lower sun (about 42° up) and a cooler sea-blue fill from below. */}
      <hemisphereLight args={["#fff1dc", "#3f6478", 0.85]} />
      <directionalLight
        key={quality.shadowSize}
        position={[6, 6.5, 4]}
        color="#ffe2b4"
        intensity={2.0}
        castShadow={quality.shadows}
        shadow-mapSize={[quality.shadowSize, quality.shadowSize]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Water land={landCenters} topology={topology} y={tableY} />
      <SeaBirds land={landCenters} />
      {screenFilters && <PostFx tier={tier} />}

      <GameBoard />

      <CameraRig
        distance={fit / (DEFAULT_ZOOM / 100)}
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
