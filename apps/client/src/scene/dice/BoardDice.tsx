// Two 3D dice on a mat beside the island (openspec physics-dice-3d; specs board-dice). A new
// roll that should animate is simulated once with physics and played back; anything else
// shows the dice at rest. The die model sits inside each body with a fixed cube rotation, so
// the side that lands up always shows the server's value. The physics code loads on mount.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Group } from "three";
import { useDiceThrow } from "../../game/diceThrow.ts";
import { latestRoll, previousRoll } from "../../game/status.ts";
import { setDiceSettled } from "../../store/dice.ts";
import { useGameStore } from "../../store/game.ts";
import { useRoomStore } from "../../store/room.ts";
import { Asset } from "../../theme/index.ts";
import { DICE_AREA, diceAreaPlacement } from "./area.ts";
import { DiceController, type DiceFrame, type Planner } from "./controller.ts";
import { rotationQuaternion } from "./faces.ts";

const MAT_COLOR = "#21423a";
const MAT_RIM = 0.12;

/** Loads the physics planner once; null while loading or if loading failed. */
function usePlanner(): Planner | null {
  const [planner, setPlanner] = useState<Planner | null>(null);
  useEffect(() => {
    let live = true;
    import("./simulate.ts")
      .then((m) => {
        if (live) setPlanner(() => m.planThrow as Planner);
      })
      .catch(() => undefined); // stays null: the dice show at rest
    return () => {
      live = false;
    };
  }, []);
  return planner;
}

function apply(frame: DiceFrame, bodies: (Group | null)[], models: (Group | null)[]): void {
  frame.bodies.forEach((pose, i) => {
    bodies[i]?.position.set(...pose.position);
    bodies[i]?.quaternion.set(...pose.quaternion);
  });
  frame.models.forEach((m, i) => models[i]?.quaternion.copy(rotationQuaternion(m)));
}

export function BoardDice({ floorY }: { floorY: number }) {
  const log = useGameStore((s) => s.log);
  const room = useRoomStore((s) => s.room) ?? "";
  const aspect = useThree((s) => (s.size.height > 0 ? s.size.width / s.size.height : 1));
  const invalidate = useThree((s) => s.invalidate);
  const roll = latestRoll(log);
  const thrown = useDiceThrow(roll);
  const planner = usePlanner();
  const controller = useRef<DiceController | null>(null);
  controller.current ??= new DiceController(previousRoll(log));
  const body0 = useRef<Group>(null);
  const body1 = useRef<Group>(null);
  const model0 = useRef<Group>(null);
  const model1 = useRef<Group>(null);
  const bodies = [body0, body1] as const;
  const models = [model0, model1] as const;
  const refs = () => [bodies.map((r) => r.current), models.map((r) => r.current)] as const;

  // One decision per new roll (thrown.key changes once per roll index).
  useLayoutEffect(() => {
    const c = controller.current!;
    const outcome = c.roll({ mode: thrown.mode, roll, previous: previousRoll(log), room, planner });
    if (outcome.settled !== null) setDiceSettled(outcome.settled);
    apply(c.frame, ...refs());
    invalidate();
    // Only a new throw decision re-runs this; later log updates in the turn do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thrown.key]);

  useFrame((state) => {
    const c = controller.current!;
    if (!c.playing) return;
    const done = c.tick(state.clock.getElapsedTime());
    apply(c.frame, ...refs());
    if (done !== null) setDiceSettled(done);
  });

  const place = diceAreaPlacement(aspect);
  return (
    <group position={[place.x, floorY, place.z]} rotation={[0, place.yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[DICE_AREA.halfX * 2 + MAT_RIM, DICE_AREA.halfZ * 2 + MAT_RIM]} />
        <meshStandardMaterial color={MAT_COLOR} roughness={0.95} />
      </mesh>
      <group ref={body0}>
        <group ref={model0}>
          <Asset assetKey="dice.die" />
        </group>
      </group>
      <group ref={body1}>
        <group ref={model1}>
          <Asset assetKey="dice.die" />
        </group>
      </group>
    </group>
  );
}
