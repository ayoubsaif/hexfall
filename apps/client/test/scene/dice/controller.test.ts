// Board dice display logic (openspec physics-dice-3d, tasks 3.3, 3.4 and 3.7).
import { describe, expect, it } from "vite-plus/test";
import type { DiceRoll } from "../../../src/game/status.ts";
import { DiceController, type Planner, REST_POSES } from "../../../src/scene/dice/controller.ts";
import { valueUp } from "../../../src/scene/dice/faces.ts";
import { planThrow } from "../../../src/scene/dice/simulate.ts";

const roll = (a: number, b: number, index = 5): DiceRoll => ({ dice: [a, b], seat: 0, index });
const q = (p: { quaternion: [number, number, number, number] }) => {
  const [x, y, z, w] = p.quaternion;
  return { x, y, z, w };
};
const shown = (c: DiceController) => [
  valueUp(q(c.frame.bodies[0]), c.frame.models[0]),
  valueUp(q(c.frame.bodies[1]), c.frame.models[1]),
];
const base = { room: "K7QX2M", previous: null, planner: planThrow as Planner };

describe("DiceController", () => {
  it("rests on 1 and 1 with no roll yet, or on the previous roll", () => {
    expect(shown(new DiceController())).toEqual([1, 1]);
    expect(shown(new DiceController(roll(2, 5)))).toEqual([2, 5]);
  });

  it("shows a snapshot roll at rest at once (spec: Resume shows the result without a throw)", () => {
    const c = new DiceController();
    const out = c.roll({ ...base, mode: "static", roll: roll(5, 2) });
    expect(out).toEqual({ settled: 5, throwing: false });
    expect(c.playing).toBe(false);
    expect(shown(c)).toEqual([5, 2]);
    expect(c.frame.bodies[0].position).toEqual(REST_POSES[0].position);
  });

  it("throws an update roll, keeps the model rotation fixed and lands on the values", () => {
    const c = new DiceController();
    const out = c.roll({ ...base, mode: "animate", roll: roll(6, 1, 9) });
    expect(out).toEqual({ settled: null, throwing: true });
    const models = c.frame.models.map((m) => m.join());
    let settled: number | null = null;
    let t = 10;
    let frames = 0;
    while (settled === null && frames < 1000) {
      settled = c.tick(t);
      expect(c.frame.models.map((m) => m.join())).toEqual(models); // spec: No end snap
      t += 1 / 60;
      frames++;
    }
    expect(settled).toBe(9);
    expect(frames / 60).toBeLessThanOrEqual(4.05);
    expect(shown(c)).toEqual([6, 1]);
    expect(c.playing).toBe(false);
  });

  it("shows at rest while the physics is not loaded or the simulation gives up", () => {
    const loading = new DiceController();
    expect(loading.roll({ ...base, mode: "animate", roll: roll(3, 4), planner: null })).toEqual({
      settled: 5,
      throwing: false,
    });
    expect(shown(loading)).toEqual([3, 4]);
    const failing = new DiceController();
    failing.roll({ ...base, mode: "animate", roll: roll(4, 4), planner: () => null });
    expect(shown(failing)).toEqual([4, 4]);
    const throwing = new DiceController();
    const boom: Planner = () => {
      throw new Error("physics broke");
    };
    expect(
      throwing.roll({ ...base, mode: "animate", roll: roll(2, 3), planner: boom }).settled,
    ).toBe(5);
    expect(shown(throwing)).toEqual([2, 3]);
  });

  it("keeps the dice where they are when a new turn starts before its roll", () => {
    const c = new DiceController();
    c.roll({ ...base, mode: "static", roll: roll(3, 6) });
    const before = JSON.stringify(c.frame);
    expect(c.roll({ ...base, mode: "static", roll: null, previous: roll(3, 6) })).toEqual({
      settled: null,
      throwing: false,
    });
    expect(JSON.stringify(c.frame)).toBe(before);
  });
});
