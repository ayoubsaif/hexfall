import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";

const ray = new Raycaster();
const point = new Vector2();
const hit = new Vector3();
const plane = new Plane(new Vector3(0, 1, 0));

/** Board-centered extent covering the camera's ground footprint, with wave/edge padding.
 * Reuses scratch vectors: no per-frame geometry allocation or oversized fixed sea. */
export function visibleSeaHalf(camera: Camera, seaLevel: number): number {
  plane.constant = -seaLevel;
  let half = 7;
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      ray.setFromCamera(point.set(x, y), camera);
      if (!ray.ray.intersectPlane(plane, hit)) return 200;
      half = Math.max(half, Math.abs(hit.x), Math.abs(hit.z));
    }
  }
  return half + 1;
}
