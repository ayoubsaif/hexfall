// A harbor boat (asset key `prop.boat`, themed GLB or procedural fallback) with its sail
// painted with the harbor label and turned toward the camera every frame (specs/board-view
// "Harbor markers"). The sail, mast, yard, sheets and lashings are found by node name (the boat
// contract in specs/asset-theming), so the same code drives the GLB and the fallback.
import type { HarborType } from "@hexfall/engine";
import { useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import { type Group, Matrix4, Mesh, type Object3D, Vector3 } from "three";
import { Asset } from "../theme/index.ts";
import { sailMaterial } from "./harborSail.ts";
import { addHullMask } from "./hullMask.ts";
import { useReducedMotion } from "./motion.ts";
import { ensureSailUVs } from "./sailUv.ts";
import { sailHeading, sailTilt, sailTurn, turnAbout } from "./sailYaw.ts";

export interface BoatHandle {
  readonly root: Group;
  readonly type: HarborType;
}

/** Bobbing on the water (specs/sea-shore "Boats bob"): rise/fall, roll and pitch amplitudes. */
export const BOB_HEIGHT = 0.008;
const BOB_ROLL = 0.035;
const BOB_PITCH = 0.015;

/** The boat's bob at time `t` (s), phased by its position so boats never move in step. */
export function bobAt(t: number, x: number, z: number): { y: number; roll: number; pitch: number } {
  const phase = x * 1.7 + z * 2.3;
  return {
    y: BOB_HEIGHT * Math.sin(t * 1.3 + phase),
    roll: BOB_ROLL * Math.sin(t * 0.9 + phase * 1.3),
    pitch: BOB_PITCH * Math.sin(t * 1.1 + phase * 0.7),
  };
}

interface Rig {
  readonly sail: Mesh;
  readonly parent: Object3D;
  /** Foot of the mast, in the hull frame: the turn and lean pivot of the whole rig. */
  readonly pivot: { x: number; y: number; z: number };
  readonly nodes: readonly { node: Object3D; original: Matrix4 }[];
  heading: number;
}

/** True while `node` is still inside `root` (the themed model replaces the fallback). */
function within(node: Object3D, root: Object3D): boolean {
  for (let n: Object3D | null = node; n; n = n.parent) if (n === root) return true;
  return false;
}

const scratch = new Vector3();

/**
 * How much larger the sail rig is drawn than in the model: the model's sail is about
 * 0.26 × 0.22 world units, this makes it about 0.44 wide, the width of a number chip.
 */
export const SAIL_SCALE = 1.7;

/** Finds the sail rig under `root` and prepares it; null until a sail is mounted. */
export function findRig(root: Object3D, type: HarborType): Rig | null {
  let sail: Mesh | null = null;
  let mast: Object3D | null = null;
  root.traverse((n) => {
    if (!sail && n instanceof Mesh && /sail/i.test(n.name)) sail = n;
    if (!mast && /mast/i.test(n.name) && !/cap/i.test(n.name)) mast = n;
  });
  const found = sail as Mesh | null;
  const parent = found?.parent;
  if (!found || !parent) return null;

  addHullMask(root);
  ensureSailUVs(found.geometry);
  found.material = sailMaterial(type);

  found.updateMatrix();
  found.geometry.computeBoundingBox();
  const box = found.geometry.boundingBox!.clone().applyMatrix4(found.matrix);
  let pivot: { x: number; y: number; z: number };
  const mastNode = mast as Object3D | null;
  if (mastNode) {
    root.updateWorldMatrix(true, true);
    mastNode.getWorldPosition(scratch);
    parent.worldToLocal(scratch);
    // The mast leans with the sail, hinged at its foot, so it never cuts across the label.
    let foot = box.min.y;
    if (mastNode instanceof Mesh && mastNode.parent === parent) {
      mastNode.updateMatrix();
      mastNode.geometry.computeBoundingBox();
      foot = mastNode.geometry.boundingBox!.clone().applyMatrix4(mastNode.matrix).min.y;
    }
    pivot = { x: scratch.x, y: foot, z: scratch.z };
  } else {
    const c = box.getCenter(new Vector3());
    pivot = { x: c.x, y: box.min.y, z: c.z };
  }
  // The rig is drawn SAIL_SCALE× larger about the mast foot, so the rate and icon read at
  // number-chip size while the hull keeps its own size.
  const grow = new Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new Matrix4().makeScale(SAIL_SCALE, SAIL_SCALE, SAIL_SCALE))
    .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  const nodes = parent.children
    .filter((n) => n === found || /yard|sheet|mast|lashing/i.test(n.name))
    .map((node) => {
      node.updateMatrix();
      node.matrixAutoUpdate = false;
      return { node, original: grow.clone().multiply(node.matrix) };
    });
  return { sail: found, parent, pivot, nodes, heading: 0 };
}

/**
 * Registers boats and turns every sail rig toward the camera once per frame, with no
 * allocation per frame. Returns the registration callback for `HarborBoat`.
 */
export function useSailRigs(): (boat: BoatHandle | null) => void {
  const boats = useRef(new Map<Group, { type: HarborType; rig: Rig | null }>());
  const reduced = useReducedMotion();
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    for (const [root, entry] of boats.current) {
      // Float: bob the boat root inside its placed group; still with reduced motion.
      const at = root.parent?.position;
      const bob = reduced || !at ? null : bobAt(t, at.x, at.z);
      root.position.y = bob?.y ?? 0;
      root.rotation.x = bob?.roll ?? 0;
      root.rotation.z = bob?.pitch ?? 0;
      if (!entry.rig || !within(entry.rig.sail, root)) entry.rig = findRig(root, entry.type);
      const rig = entry.rig;
      if (!rig) continue;
      rig.parent.worldToLocal(scratch.copy(camera.position));
      rig.heading = sailHeading(scratch, rig.pivot, rig.heading);
      const angle = sailTurn(rig.heading);
      const tilt = sailTilt(scratch, rig.pivot);
      for (const { node, original } of rig.nodes)
        turnAbout(node.matrix, original, rig.pivot, angle, tilt);
    }
  });
  return useCallback((boat: BoatHandle | null) => {
    if (!boat) return;
    boats.current.set(boat.root, { type: boat.type, rig: null });
    return () => {
      boats.current.delete(boat.root);
    };
  }, []);
}

export function HarborBoat({
  type,
  register,
}: {
  type: HarborType;
  register: (boat: BoatHandle | null) => void;
}) {
  const ref = useCallback(
    (root: Group | null) => (root ? register({ root, type }) : undefined),
    [register, type],
  );
  return (
    <group ref={ref} name="boat">
      <Asset assetKey="prop.boat" />
    </group>
  );
}
