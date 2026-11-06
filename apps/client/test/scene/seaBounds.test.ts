import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3, PlaneGeometry } from "three";
import { describe, expect, it } from "vite-plus/test";
import { visibleSeaHalf } from "../../src/scene/seaBounds.ts";
import { QUALITY } from "../../src/scene/graphicsQuality.ts";

describe("visible sea footprint", () => {
  it("covers all corners during orbit, tilt, zoom and portrait/landscape framing", () => {
    for (const aspect of [16 / 9, 9 / 16]) {
      for (const elevation of [30, 60, 89]) {
        for (const distance of [8, 20, 45]) {
          const camera = new PerspectiveCamera(45, aspect, 0.1, 1000);
          const angle = (elevation * Math.PI) / 180;
          camera.position.set(
            distance * Math.cos(angle) * 0.6,
            distance * Math.sin(angle),
            distance * Math.cos(angle) * 0.8,
          );
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld();
          const half = visibleSeaHalf(camera, -0.16);
          const ray = new Raycaster();
          for (const x of [-1, 1])
            for (const y of [-1, 1]) {
              ray.setFromCamera(new Vector2(x, y), camera);
              const hit = ray.ray.intersectPlane(
                new Plane(new Vector3(0, 1, 0), 0.16),
                new Vector3(),
              )!;
              expect(Math.max(Math.abs(hit.x), Math.abs(hit.z))).toBeLessThan(half);
            }
        }
      }
    }
  });
  it("uses a smaller surface at the default view and only two triangles on Low", () => {
    const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 1000);
    camera.position.set(0, 12, 8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    expect(visibleSeaHalf(camera, -0.16)).toBeLessThan(25);
    const geometry = new PlaneGeometry(200, 200, QUALITY.low.segments, QUALITY.low.segments);
    expect(geometry.index!.count / 3).toBe(2);
    geometry.dispose();
  });
});
