// Every player's roads, settlements and cities from the view (specs/board-interaction,
// "Live board from the game view"). New pieces from an update drop into place.
import type { PlayerView } from "@hexfall/engine";
import { topologyOf } from "@hexfall/engine/geometry";
import { useFrame } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { useGameStore } from "../store/game.ts";
import { Asset, useLandRelief } from "../theme/index.ts";
import { dropOffset, motionDurations, newPieceKeys, useReducedMotion } from "./motion.ts";
import { type PieceItem, pieceLayout } from "./pieces.ts";

function Drop({ y, durationMs, children }: { y: number; durationMs: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const done = useRef(durationMs <= 0);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g || done.current) return;
    const now = clock.elapsedTime * 1000;
    start.current ??= now;
    const off = dropOffset(now - start.current, durationMs);
    g.position.y = y + off;
    if (off === 0) done.current = true;
  });
  // Fixed at mount: re-renders must not reset a running drop (the frame loop owns y).
  const [initial] = useState(
    () => [0, durationMs > 0 ? y + dropOffset(0, durationMs) : y] as const,
  );
  return (
    <group ref={ref} position={[initial[0], initial[1], 0]}>
      {children}
    </group>
  );
}

function Piece({ item, dropMs }: { item: PieceItem; dropMs: number }) {
  return (
    <group position={[item.position[0], 0, item.position[1]]} rotation={[0, item.yaw, 0]}>
      <Drop y={item.y} durationMs={dropMs}>
        <Asset assetKey={item.assetKey} playerColor={item.color} />
      </Drop>
    </group>
  );
}

export function Pieces({ view }: { view: PlayerView }) {
  const relief = useLandRelief();
  const source = useGameStore((s) => s.source);
  const reduced = useReducedMotion();
  const items = useMemo(
    () => pieceLayout(view.vertices, view.edges, relief, topologyOf(view.board)),
    [view.vertices, view.edges, relief, view.board],
  );

  // Which keys are new in this render (decided once per item list, not per frame).
  const known = useRef<Set<string> | null>(null);
  const dropping = useMemo(() => {
    const keys = items.map((i) => i.key);
    const fresh = newPieceKeys(known.current, keys, source);
    known.current = new Set(keys);
    return fresh;
    // `source` is read at the moment the items change; a later source change alone must not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const { drop } = motionDurations(reduced);
  return (
    <>
      {items.map((item) => (
        <Piece key={item.key} item={item} dropMs={dropping.has(item.key) ? drop : 0} />
      ))}
    </>
  );
}
