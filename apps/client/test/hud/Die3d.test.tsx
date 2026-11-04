// Die3d cube (openspec dice-tray-3d, tasks 1.2 and 1.3).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  Die3d,
  type DieValue,
  FACE_PLACEMENT,
  FACE_ROTATION,
  PIPS,
} from "../../src/hud/dice/Die3d.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const VALUES: DieValue[] = [1, 2, 3, 4, 5, 6];

describe("Die3d", () => {
  it.each(VALUES)("draws face %i with that many pips in the right colors", (v) => {
    act(() => root.render(<Die3d value={v} />));
    const face = container.querySelector(`[data-face="${v}"]`)!;
    const pips = face.querySelectorAll("[data-pip]");
    expect(pips).toHaveLength(v);
    const red = v === 1 || v === 4;
    for (const p of pips) {
      expect(p.className).toContain(red ? "bg-pip-red" : "bg-pip");
      if (!red) expect(p.className).not.toContain("bg-pip-red");
    }
  });

  it("draws all six faces, decorative only", () => {
    act(() => root.render(<Die3d value={3} />));
    expect(container.querySelectorAll("[data-face]")).toHaveLength(6);
    expect(container.querySelector("[data-die]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("enlarges the single pip", () => {
    act(() => root.render(<Die3d value={1} />));
    const one = container.querySelector('[data-face="1"] [data-pip]')!;
    const five = container.querySelector('[data-face="5"] [data-pip]')!;
    expect(one.className).toContain("size-[190%]");
    expect(five.className).toContain("size-[70%]");
  });

  it("animates only while throwing", () => {
    act(() => root.render(<Die3d value={2} />));
    expect(container.querySelector(".animate-dice-tumble")).toBeNull();
    act(() => root.render(<Die3d value={2} throwing delay={80} />));
    const cube = container.querySelector<HTMLElement>("[data-die-cube]")!;
    expect(cube.className).toContain("animate-dice-tumble");
    expect(cube.style.animationDelay).toBe("80ms");
    expect(container.querySelector("[data-die-hop]")?.className).toContain("animate-dice-bounce");
  });

  it("opposite faces sum to 7", () => {
    expect(PIPS[1].length + PIPS[6].length).toBe(7);
    expect(FACE_PLACEMENT[1]).toBe("rotateY(0deg)");
    expect(FACE_PLACEMENT[6]).toBe("rotateY(180deg)");
    expect([FACE_PLACEMENT[2], FACE_PLACEMENT[5]]).toEqual(["rotateX(90deg)", "rotateX(-90deg)"]);
    expect([FACE_PLACEMENT[3], FACE_PLACEMENT[4]]).toEqual(["rotateY(90deg)", "rotateY(-90deg)"]);
  });
});

// CSS rotations (y axis points down): rotateX(a) and rotateY(a) as 3x3 matrices.
type V = [number, number, number];
const rad = (d: number) => (d * Math.PI) / 180;
function rotX(a: number, [x, y, z]: V): V {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [x, y * c - z * s, y * s + z * c];
}
function rotY(a: number, [x, y, z]: V): V {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [x * c + z * s, y, -x * s + z * c];
}
/** Applies a "rotateX(..) / rotateY(..)" placement string to a vector. */
function place(t: string, v: V): V {
  const m = /rotate([XY])\((-?\d+)deg\)/.exec(t)!;
  return m[1] === "X" ? rotX(Number(m[2]), v) : rotY(Number(m[2]), v);
}

describe("FACE_ROTATION", () => {
  it.each(VALUES)("turns face %i to the viewer", (v) => {
    // The face normal: +Z carried by the face's placement on the cube.
    const normal = place(FACE_PLACEMENT[v], [0, 0, 1]);
    // The cube transform "rotateX(x) rotateY(y)" applies rotateY first to points.
    const r = FACE_ROTATION[v];
    const out = rotX(r.x, rotY(r.y, normal));
    expect(out[0]).toBeCloseTo(0, 9);
    expect(out[1]).toBeCloseTo(0, 9);
    expect(out[2]).toBeCloseTo(1, 9);
  });
});
