// Number-token chips turn to the camera (openspec flat-board-3d-chips, tasks 3.1 and 3.3;
// specs/board-view "Number tokens").
import { Group, Mesh, PlaneGeometry, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import { YAW_EPSILON, cameraYaw, turnChips } from "../../src/scene/chipYaw.ts";

const O = { x: 0, z: 0 };

describe("cameraYaw", () => {
  it("is 0 from the south and follows the camera around", () => {
    expect(cameraYaw({ x: 0, z: 10 }, O, 1)).toBe(0);
    expect(cameraYaw({ x: 10, z: 0 }, O, 0)).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(cameraYaw({ x: 0, z: -10 }, O, 0))).toBeCloseTo(Math.PI);
    expect(cameraYaw({ x: -10, z: 0 }, O, 0)).toBeCloseTo(-Math.PI / 2);
  });

  it("is measured from the orbit target", () => {
    expect(cameraYaw({ x: 3, z: 12 }, { x: 3, z: 2 }, 1)).toBe(0);
  });

  it("keeps the previous turn when the camera is straight above", () => {
    expect(cameraYaw({ x: 0, z: 0 }, O, 0.7)).toBe(0.7);
    expect(cameraYaw({ x: YAW_EPSILON / 2, z: 0 }, O, -1)).toBe(-1);
  });
});

/** A chip group at a hex center with a label plane lying flat, image top toward −Z. */
function chip(x: number, z: number) {
  const outer = new Group();
  outer.position.set(x, 0, z);
  const turning = new Group();
  const label = new Mesh(new PlaneGeometry(0.5, 0.5));
  label.rotation.x = -Math.PI / 2;
  turning.add(label);
  outer.add(turning);
  return { outer, turning };
}

/** The label's "up" (image top) in world space, projected on the board plane. */
function labelUp(turning: Group): Vector3 {
  turning.updateWorldMatrix(true, true);
  const top = new Vector3(0, 0, -1).applyQuaternion(turning.getWorldQuaternion(new Quaternion()));
  return top.setY(0).normalize();
}

describe("turnChips", () => {
  it("turns every chip so its number points away from the camera, without moving it", () => {
    const chips = [chip(0, 0), chip(1.7, -3), chip(-2.6, 1.5)];
    const turning = chips.map((c) => c.turning);
    const before = chips.map((c) => c.outer.getWorldPosition(new Vector3()));
    for (const camera of [
      { x: 0, z: 10 },
      { x: 10, z: 0 },
      { x: 0, z: -10 },
    ]) {
      const yaw = cameraYaw(camera, O, 0);
      turnChips(turning, yaw);
      const away = new Vector3(-camera.x, 0, -camera.z).normalize();
      chips.forEach((c, i) => {
        expect(c.turning.rotation.y).toBe(yaw);
        // Image top points away from the camera: the number reads upright on screen.
        expect(labelUp(c.turning).dot(away)).toBeCloseTo(1);
        expect(c.outer.getWorldPosition(new Vector3()).distanceTo(before[i]!)).toBe(0);
      });
    }
  });
});
