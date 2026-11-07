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
import { ensureSailUVs } from "./sailUv.ts";
import { sailHeading, sailTilt, sailTurn, turnAbout } from "./sailYaw.ts";

export interface BoatHandle {
  readonly root: Group;
  readonly type: HarborType;
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
  const nodes = parent.children
    .filter((n) => n === found || /yard|sheet|mast|lashing/i.test(n.name))
    .map((node) => {
      node.updateMatrix();
      node.matrixAutoUpdate = false;
      return { node, original: node.matrix.clone() };
    });
  return { sail: found, parent, pivot, nodes, heading: 0 };
}

/**
 * Registers boats and turns every sail rig toward the camera once per frame, with no
 * allocation per frame. Returns the registration callback for `HarborBoat`.
 */
export function useSailRigs(): (boat: BoatHandle | null) => void {
  const boats = useRef(new Map<Group, { type: HarborType; rig: Rig | null }>());
  useFrame(({ camera }) => {
    for (const [root, entry] of boats.current) {
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
