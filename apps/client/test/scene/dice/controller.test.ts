// Board dice display logic (openspec physics-dice-3d, tasks 3.3, 3.4 and 3.7; dice-center-fade,
// task 3.4).
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
const base = { room: "K7QX2M", reason: "update" as const, planner: planThrow as Planner };

/** Ticks at 60 fps from `t` until the throw rests; returns the settled index and end time. */
function playThrow(c: DiceController, t = 10) {
  let settled: number | null = null;
  let frames = 0;
  while (settled === null && frames < 1000) {
    settled = c.tick(t);
    t += 1 / 60;
    frames++;
  }
  return { settled, t, frames };
}

describe("DiceController", () => {
  it("is hidden before any roll", () => {
    const c = new DiceController();
    expect(c.visible).toBe(false);
    expect(c.playing).toBe(false);
  });

  it("hides a snapshot roll but still reports it settled (spec: Resume shows no board dice)", () => {
    const c = new DiceController();
    const out = c.roll({ ...base, mode: "static", reason: "snapshot", roll: roll(5, 2) });
    expect(out).toEqual({ settled: 5, throwing: false });
    expect(c.visible).toBe(false);
    expect(c.playing).toBe(false);
  });

  it("shows a reduced-motion roll at rest and keeps it on the table", () => {
    const c = new DiceController();
    const out = c.roll({ ...base, mode: "static", reason: "reduced", roll: roll(6, 6) });
    expect(out).toEqual({ settled: 5, throwing: false });
    expect(shown(c)).toEqual([6, 6]);
    expect(c.frame.bodies[0].position).toEqual(REST_POSES[0].position);
    expect(c.phase).toBe("resting");
    expect(c.playing).toBe(false);
    c.tick(100);
    c.tick(10_000);
    expect(c.phase).toBe("resting");
    expect(c.visible).toBe(true);
  });

  it("keeps a thrown roll resting on the table, with no hold or fade (spec: Dice stay on the table)", () => {
    const c = new DiceController();
    c.roll({ ...base, mode: "animate", roll: roll(4, 2, 7) });
    expect(c.playing).toBe(true);
    const { settled, t } = playThrow(c);
    expect(settled).toBe(7);
    expect(c.phase).toBe("resting");
    expect(c.playing).toBe(false); // no more frames to play
    const pose = JSON.stringify(c.frame);
    expect(c.tick(t + 60)).toBeNull();
    expect(c.visible).toBe(true);
    expect(JSON.stringify(c.frame)).toBe(pose);
  });

  it("replaces the resting dice when the next roll arrives", () => {
    const c = new DiceController();
    c.roll({ ...base, mode: "animate", roll: roll(1, 2, 3) });
    const { t } = playThrow(c);
    expect(c.phase).toBe("resting");
    expect(c.roll({ ...base, mode: "animate", roll: roll(5, 5, 4) }).throwing).toBe(true);
    expect(c.phase).toBe("throwing");
    expect(playThrow(c, t + 20).settled).toBe(4);
    expect(shown(c)).toEqual([5, 5]);
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
    expect(c.phase).toBe("resting");
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

  it("leaves the last dice on the table when a new turn starts before its roll", () => {
    const c = new DiceController();
    c.roll({ ...base, mode: "static", reason: "reduced", roll: roll(3, 6) });
    const before = JSON.stringify(c.frame);
    expect(c.roll({ ...base, mode: "static", roll: null })).toEqual({
      settled: null,
      throwing: false,
    });
    expect(JSON.stringify(c.frame)).toBe(before);
    expect(c.visible).toBe(true);
  });
});
