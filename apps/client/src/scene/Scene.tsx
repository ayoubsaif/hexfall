// The board scene: lighting, sea background, the board (preview or live game), pieces,
// pick targets and camera controls.
import { beginnerBoard } from "@hexfall/engine/geometry";
import { OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import { useGameStore } from "../store/game.ts";
import { ISO_ELEVATION_DEG, useLandRelief } from "../theme/index.ts";
import { BoardView } from "./BoardView.tsx";
import { producingHexes } from "./motion.ts";
import { Pieces } from "./Pieces.tsx";
import { Targets } from "./Targets.tsx";
import { useFitCamera } from "./useFitCamera.ts";

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
    </>
  );
}

const SEA_COLOR = "#2f6f8f";
/** Max camera turn left/right from the art's view when tiles are isometric (radians). */
const ISO_AZIMUTH_LIMIT = (25 * Math.PI) / 180;

export function Scene() {
  // Isometric tile art is painted for one view: start there and allow only a small turn.
  const relief = useLandRelief();
  const fit = useFitCamera(relief.raised ? (ISO_ELEVATION_DEG * Math.PI) / 180 : undefined);
  const turn = relief.raised ? ISO_AZIMUTH_LIMIT : Infinity;
  return (
    <>
      <hemisphereLight args={["#fff6e5", "#4a6a7a", 0.8]} />
      <directionalLight
        position={[6, 12, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, relief.seaLevel - 0.02, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={SEA_COLOR} roughness={1} />
      </mesh>

      <GameBoard />

      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.2}
        minAzimuthAngle={-turn}
        maxAzimuthAngle={turn}
        minDistance={fit * 0.45}
        maxDistance={fit * 1.5}
      />
    </>
  );
}
