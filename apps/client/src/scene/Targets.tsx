// Legal-move highlights and hit areas for the current pick (specs/board-interaction,
// "Legal target highlights", "Picking sends one action", "Robber move and victim choice").
// Only legal targets get meshes, so illegal spots can never react to the pointer.
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { currentPick } from "../game/pick.ts";
import { act } from "../net/actions.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useGameStore } from "../store/game.ts";
import { chooseBuild, setVictimHex, useUiStore } from "../store/ui.ts";
import { useLandRelief } from "../theme/index.ts";
import {
  EDGE_TARGET_LENGTH,
  EDGE_TARGET_WIDTH,
  HEX_TARGET_RADIUS,
  type TargetItem,
  VERTEX_TARGET_RADIUS,
  targetLayout,
} from "./pieces.ts";
import { isDrag, pickOutcome } from "./picking.ts";

const COLOR = "#fff3b0";
const HOVER_COLOR = "#ffd84a";

function TargetMesh({
  item,
  hovered,
  onHover,
  onPick,
}: {
  item: TargetItem;
  hovered: boolean;
  onHover: (id: number | null) => void;
  onPick: (id: number, e: ThreeEvent<MouseEvent>) => void;
}) {
  const opacity = item.target === "hex" ? (hovered ? 0.45 : 0.2) : hovered ? 0.95 : 0.6;
  const scale = hovered && item.target !== "hex" ? 1.25 : 1;
  return (
    <group
      position={[item.position[0], item.y, item.position[1]]}
      rotation={[0, item.yaw, 0]}
      scale={[scale, 1, scale]}
    >
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={10}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(item.id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPick(item.id, e);
        }}
      >
        {item.target === "vertex" && <circleGeometry args={[VERTEX_TARGET_RADIUS, 24]} />}
        {item.target === "edge" && <planeGeometry args={[EDGE_TARGET_LENGTH, EDGE_TARGET_WIDTH]} />}
        {/* Pointy-top hex: corners at ±Z, so start the 6-gon at 30°. */}
        {item.target === "hex" && <circleGeometry args={[HEX_TARGET_RADIUS, 6, Math.PI / 6]} />}
        <meshBasicMaterial
          color={hovered ? HOVER_COLOR : COLOR}
          transparent
          opacity={opacity}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function Targets() {
  const view = useGameStore((s) => s.view);
  const legal = useGameStore((s) => s.legal);
  // Nothing is pickable while an action is in flight or the connection is down.
  const connected = useConnectionStore((s) => s.status === "open");
  const inFlight = useGameStore((s) => s.inFlight) || !connected;
  const build = useUiStore((s) => s.build);
  const victimHex = useUiStore((s) => s.victimHex);
  const relief = useLandRelief();
  const gl = useThree((s) => s.gl);

  const pick = useMemo(
    () => currentPick({ view, legal, build, inFlight, victimHex }),
    [view, legal, build, inFlight, victimHex],
  );
  const items = useMemo(() => targetLayout(pick, relief), [pick, relief]);
  const [hovered, setHovered] = useState<number | null>(null);

  // Forget a hover whose target went away, and show the pointer cursor while hovering.
  const hoverLive = hovered !== null && items.some((i) => i.id === hovered);
  useEffect(() => {
    const el = gl.domElement;
    el.style.cursor = hoverLive ? "pointer" : "";
    return () => {
      el.style.cursor = "";
    };
  }, [hoverLive, gl]);

  if (!pick) return null;

  const onPick = (id: number, e: ThreeEvent<MouseEvent>) => {
    if (isDrag(e.delta)) return;
    const outcome = pickOutcome(
      pick,
      id,
      (hex) => legal?.moveRobber.find((o) => o.hex === hex)?.victims,
    );
    if (outcome.kind === "chooseVictim") {
      setVictimHex(outcome.hex);
    } else if (outcome.kind === "send") {
      if (act(outcome.action)) chooseBuild(null);
    }
    setHovered(null);
  };

  return (
    <>
      {items.map((item) => (
        <TargetMesh
          key={item.key}
          item={item}
          hovered={hoverLive && hovered === item.id}
          onHover={setHovered}
          onPick={onPick}
        />
      ))}
    </>
  );
}
