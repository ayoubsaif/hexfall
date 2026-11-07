// Two 3D dice thrown onto the middle of the island (openspec physics-dice-3d, dice-center-fade;
// specs board-dice). A new roll that should animate is simulated once with physics and played
// back; otherwise the dice show at rest (or not at all for a snapshot). Once at rest they stay
// on the table until the next roll. The die model sits inside each body with a fixed cube
// rotation, so the side that lands up always shows the server's value. The physics code loads
// on mount.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Group, Mesh, Object3D } from "three";
import { useDiceThrow } from "../../game/diceThrow.ts";
import { latestRoll } from "../../game/status.ts";
import { setDiceSettled } from "../../store/dice.ts";
import { useGameStore } from "../../store/game.ts";
import { useRoomStore } from "../../store/room.ts";
import { Asset } from "../../theme/index.ts";
import { DICE_LIFT, DICE_SCALE, DIE_MODEL_SCALE } from "./area.ts";
import { DiceController, type Planner } from "./controller.ts";
import { diceObstacles } from "./obstacles.ts";
import { rotationQuaternion } from "./faces.ts";

const noRaycast = () => undefined;

/**
 * Turns off pointer picks on a die's meshes, so hexes and pieces under the dice stay pickable.
 * The model may load later, so this runs on every visible frame and skips meshes already done.
 */
function ignorePointer(root: Object3D | null): void {
  root?.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || mesh.userData.diceReady) return;
    mesh.raycast = noRaycast;
    mesh.userData.diceReady = true;
  });
}

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

function apply(c: DiceController, bodies: (Group | null)[], models: (Group | null)[]): void {
  const { frame, visible } = c;
  bodies.forEach((b) => {
    if (b) b.visible = visible;
  });
  frame.bodies.forEach((pose, i) => {
    bodies[i]?.position.set(...pose.position);
    bodies[i]?.quaternion.set(...pose.quaternion);
  });
  frame.models.forEach((m, i) => models[i]?.quaternion.copy(rotationQuaternion(m)));
}

/** `floorY`: height of the land surface the dice land on. */
export function BoardDice({ floorY }: { floorY: number }) {
  const log = useGameStore((s) => s.log);
  const view = useGameStore((s) => s.view);
  const room = useRoomStore((s) => s.room) ?? "";
  const invalidate = useThree((s) => s.invalidate);
  const roll = latestRoll(log);
  const thrown = useDiceThrow(roll);
  const planner = usePlanner();
  const controller = useRef<DiceController | null>(null);
  controller.current ??= new DiceController();
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
    const outcome = c.roll({
      mode: thrown.mode,
      reason: thrown.reason,
      roll,
      room,
      planner,
      obstacles: view && thrown.mode === "animate" ? diceObstacles(view) : [],
    });
    if (outcome.settled !== null) setDiceSettled(outcome.settled);
    apply(c, ...refs());
    invalidate();
    // Only a new throw decision re-runs this; later log updates in the turn do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thrown.key]);

  useFrame((state) => {
    const c = controller.current!;
    if (c.visible) for (const r of bodies) ignorePointer(r.current);
    if (!c.playing) return;
    const done = c.tick(state.clock.getElapsedTime());
    apply(c, ...refs());
    if (done !== null) setDiceSettled(done);
  });

  return (
    <group position={[0, floorY + DICE_LIFT, 0]} scale={DICE_SCALE}>
      <group ref={body0} visible={false}>
        <group ref={model0} scale={DIE_MODEL_SCALE}>
          <Asset assetKey="dice.die" />
        </group>
      </group>
      <group ref={body1} visible={false}>
        <group ref={model1} scale={DIE_MODEL_SCALE}>
          <Asset assetKey="dice.die" />
        </group>
      </group>
    </group>
  );
}
