// Draws a board value: a thin map over the pure layout model (specs/board-view).
// A live game passes the robber hex and the hexes that just produced (board-interaction).
import { IslandGround, useIslandTextureUrls } from "./IslandGround.tsx";
import type { Board, HexId } from "@hexfall/engine";
import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Group, MeshBasicMaterial } from "three";
import type { WriteSource } from "../store/game.ts";
import { Asset, domeHeight, useLandRelief } from "../theme/index.ts";
import { faceChips } from "./chipYaw.ts";
import { HarborMarker } from "./HarborMarker.tsx";
import { type XZ, boardLayout } from "./layout.ts";
import {
  glowStrength,
  motionDurations,
  robberPath,
  shouldTweenRobber,
  useReducedMotion,
} from "./motion.ts";
import { NumberToken } from "./NumberToken.tsx";

export interface BoardViewProps {
  board: Board;
  /** Robber hex; defaults to the board's own (the preview). */
  robberHex?: HexId;
  /** Hexes whose tokens glow briefly (production on the latest roll). */
  glowHexes?: readonly HexId[];
  /** Changes on every roll so the same hexes can glow again. */
  glowKey?: number;
  /** How the current state arrived; snapshots never animate. */
  source?: WriteSource | null;
}

/** Robber that tweens to a new hex on updates and jumps on snapshots or reduced motion. */
function Robber({
  hex,
  position,
  source,
  lift = 0,
}: {
  hex: HexId;
  position: XZ;
  source: WriteSource | null;
  /** Height of the land under the robber (domed terrain). */
  lift?: number;
}) {
  const ref = useRef<Group>(null);
  const reduced = useReducedMotion();
  const prev = useRef<{ hex: HexId; position: XZ } | null>(null);
  const tween = useRef<{
    from: XZ;
    to: XZ;
    start: number | null;
    ms: number;
  } | null>(null);

  if (prev.current?.hex !== hex) {
    const ms = motionDurations(reduced).robber;
    tween.current =
      prev.current && shouldTweenRobber(prev.current.hex, hex, source) && ms > 0
        ? { from: prev.current.position, to: position, start: null, ms }
        : null;
    prev.current = { hex, position };
  }

  useFrame(({ clock }) => {
    const g = ref.current;
    const t = tween.current;
    if (!g || !t) return;
    const now = clock.elapsedTime * 1000;
    t.start ??= now;
    const [x, y, z] = robberPath(t.from, t.to, now - t.start, t.ms);
    g.position.set(x, y, z);
    if (now - t.start >= t.ms) {
      g.position.set(t.to[0], 0, t.to[1]);
      tween.current = null;
    }
  });

  const start = tween.current?.from ?? position;
  return (
    <group ref={ref} position={[start[0], 0, start[1]]}>
      <group position={[0, lift, 0]}>
        <Asset assetKey="piece.robber" />
      </group>
    </group>
  );
}

const GLOW_COLOR = "#fff1a8";

/** A soft ring under a token that flashes once when mounted (one mount per roll). */
function Glow({ ms }: { ms: number }) {
  const mat = useRef<MeshBasicMaterial>(null);
  const start = useRef<number | null>(null);
  const [done, setDone] = useState(ms <= 0);
  useFrame(({ clock }) => {
    const m = mat.current;
    if (!m || done) return;
    const now = clock.elapsedTime * 1000;
    start.current ??= now;
    const s = glowStrength(now - start.current, ms);
    m.opacity = 0.75 * s;
    if (now - start.current >= ms) setDone(true);
  });
  if (done) return null;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      renderOrder={5}
    >
      <ringGeometry args={[0.32, 0.62, 32]} />
      <meshBasicMaterial
        ref={mat}
        color={GLOW_COLOR}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Registers chip groups and faces them toward the camera in pitch and yaw once per frame
 * (design decision 3). Returns a callback ref for each chip's turning group.
 */
function useChipFacing(): (g: Group | null) => void {
  const groups = useRef(new Set<Group>());
  useFrame(({ camera }) => {
    faceChips(groups.current, camera.quaternion);
  });
  return useCallback((g: Group | null) => {
    if (!g) return;
    groups.current.add(g);
    return () => {
      groups.current.delete(g);
    };
  }, []);
}

export function BoardView({
  board,
  robberHex,
  glowHexes,
  glowKey = 0,
  source = null,
}: BoardViewProps) {
  const layout = useMemo(
    () => boardLayout(board, robberHex),
    [board, robberHex],
  );
  const reduced = useReducedMotion();
  const glowMs = motionDurations(reduced).glow;
  const glowing = useMemo(() => new Set(glowHexes ?? []), [glowHexes]);
  const chipRef = useChipFacing();
  // Domed land lifts each hex's token to the top of its dome.
  const relief = useLandRelief();
  const terrainOf = useMemo(
    () => new Map(layout.tiles.map((t) => [t.hex, t.assetKey])),
    [layout],
  );
  const lift = (hex: number) =>
    relief.raised ? domeHeight(terrainOf.get(hex) ?? "", 0) : 0;
  // Image themes draw the land as one continuous island surface (IslandGround) instead of
  // one block per tile. Keyed on tile positions and terrains, so moving the robber (which
  // rebuilds the layout) does not rebuild the island mesh.
  const islandUrls = useIslandTextureUrls();
  const islandKey = layout.tiles
    .map((t) => `${t.assetKey}@${t.position.join(",")}`)
    .join("|");
  const islandTiles = useMemo(
    () =>
      layout.tiles.map((t) => ({ position: t.position, assetKey: t.assetKey })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [islandKey],
  );
  const islandLand = useMemo(
    () => islandTiles.map((t) => t.position),
    [islandTiles],
  );
  const island = relief.raised && islandUrls !== null;
  const robber = layout.robber;
  const robberCenter =
    layout.tiles.find((t) => t.hex === robber.hex)?.position ?? robber.position;
  const robberLift = relief.raised
    ? domeHeight(
        terrainOf.get(robber.hex) ?? "",
        Math.hypot(
          robber.position[0] - robberCenter[0],
          robber.position[1] - robberCenter[1],
        ),
      )
    : 0;
  return (
    <>
      {/* The sea itself is the procedural Water plane in Scene (no sea tile images). */}
      {island ? (
        <IslandGround
          tiles={islandTiles}
          land={islandLand}
          seaLevel={relief.seaLevel}
          urls={islandUrls}
        />
      ) : (
        layout.tiles.map((t) => (
          <group key={t.key} position={[t.position[0], 0, t.position[1]]}>
            <Asset assetKey={t.assetKey} />
          </group>
        ))
      )}
      {layout.tokens.map((t) => (
        <group
          key={t.key}
          position={[t.position[0], lift(t.hex), t.position[1]]}
        >
          <group ref={chipRef} name="chip">
            <NumberToken value={t.value} />
          </group>
          {glowMs > 0 && glowing.has(t.hex) && (
            <Glow key={glowKey} ms={glowMs} />
          )}
        </group>
      ))}
      {layout.harbors.map((h) => (
        <HarborMarker key={h.key} item={h} chipRef={chipRef} />
      ))}
      <Robber
        hex={layout.robber.hex}
        position={layout.robber.position}
        source={source}
        lift={robberLift}
      />
    </>
  );
}
