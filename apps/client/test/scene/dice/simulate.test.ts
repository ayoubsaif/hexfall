// Seeded physics throw (openspec change physics-dice-3d, tasks 2.3–2.6).
import { describe, expect, it } from "vite-plus/test";
import { poseAt } from "../../../src/scene/dice/controller.ts";
import { valueUp } from "../../../src/scene/dice/faces.ts";
import { hashString, mulberry32, throwParams } from "../../../src/scene/dice/seed.ts";
import {
  DICE_AREA,
  MAX_ATTEMPTS,
  MAX_SECONDS,
  type SimResult,
  planThrow,
  recordingSeconds,
  simulate,
} from "../../../src/scene/dice/simulate.ts";
import { DIE_EDGE, DIE_VALUES, type DieValue } from "../../../src/theme/die.ts";

const restQuat = (plan: { recording: { frames: number; data: Float32Array } }, die: 0 | 1) => {
  const [x, y, z, w] = poseAt(plan.recording, die, 1e9).quaternion;
  return { x, y, z, w };
};

describe("seed", () => {
  it("is stable for the same inputs and differs by roll, room and attempt", () => {
    expect(hashString("ABCDEF|3|0")).toBe(hashString("ABCDEF|3|0"));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const p = (room: string, index: number, attempt: number) =>
      JSON.stringify(throwParams({ room, index, attempt }, DICE_AREA));
    expect(p("ABCDEF", 3, 0)).toBe(p("ABCDEF", 3, 0));
    expect(p("ABCDEF", 3, 0)).not.toBe(p("ABCDEF", 4, 0));
    expect(p("ABCDEF", 3, 0)).not.toBe(p("ABCDEG", 3, 0));
    expect(p("ABCDEF", 3, 0)).not.toBe(p("ABCDEF", 3, 1));
  });
});

describe("simulate", () => {
  it("is deterministic (spec: Deterministic simulation)", () => {
    const a = simulate({ room: "K7QX2M", index: 12, attempt: 0 });
    const b = simulate({ room: "K7QX2M", index: 12, attempt: 0 });
    expect(a.recording.frames).toBe(b.recording.frames);
    expect(Buffer.from(a.recording.data.buffer).equals(Buffer.from(b.recording.data.buffer))).toBe(
      true,
    );
  });

  it("keeps the dice inside the area and ends within the time cap", () => {
    for (let index = 0; index < 40; index++) {
      const { recording } = simulate({ room: "AREA01", index, attempt: 0 });
      expect(recordingSeconds(recording)).toBeLessThanOrEqual(MAX_SECONDS);
      const margin = DIE_EDGE; // a die's center stays within one edge of the walls
      for (let f = 0; f < recording.frames; f++) {
        for (const die of [0, 1] as const) {
          const at = f * 14 + die * 7;
          expect(Math.abs(recording.data[at]!)).toBeLessThan(DICE_AREA.halfX + margin);
          expect(Math.abs(recording.data[at + 2]!)).toBeLessThan(DICE_AREA.halfZ + margin);
          expect(recording.data[at + 1]!).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("planThrow (spec: Dice land on the server's roll)", () => {
  it("lands every one of the 36 value pairs over many seeds", () => {
    for (const a of DIE_VALUES) {
      for (const b of DIE_VALUES) {
        for (let index = 0; index < 4; index++) {
          const plan = planThrow("PAIRS1", a * 100 + b * 10 + index, [a, b]);
          expect(plan).not.toBeNull();
          expect(valueUp(restQuat(plan!, 0), plan!.models[0])).toBe(a);
          expect(valueUp(restQuat(plan!, 1), plan!.models[1])).toBe(b);
        }
      }
    }
  });

  it("retries an unsettled attempt with the next seed (spec: Leaning die)", () => {
    const attempts: number[] = [];
    const sim = (key: Parameters<typeof simulate>[0]): SimResult => {
      attempts.push(key.attempt);
      const real = simulate(key);
      return key.attempt === 0 ? { ...real, settled: false } : real;
    };
    const values: [DieValue, DieValue] = [6, 1];
    const plan = planThrow("RETRY1", 7, values, DICE_AREA, sim);
    expect(plan?.attempt).toBeGreaterThanOrEqual(1);
    expect(attempts[0]).toBe(0);
    expect(attempts[1]).toBe(1);
  });

  it("gives up after MAX_ATTEMPTS so the dice show at rest", () => {
    let calls = 0;
    const sim = (key: Parameters<typeof simulate>[0]): SimResult => {
      calls++;
      return { ...simulate(key), settled: false };
    };
    expect(planThrow("GIVEUP", 1, [3, 4], DICE_AREA, sim)).toBeNull();
    expect(calls).toBe(MAX_ATTEMPTS);
  });
});

describe("poseAt", () => {
  it("clamps to the first and last frame and returns unit quaternions", () => {
    const { recording } = simulate({ room: "SAMPLE", index: 0, attempt: 0 });
    const first = poseAt(recording, 0, -1);
    const stored = Array.from(recording.data.subarray(0, 7));
    [...first.position, ...first.quaternion].forEach((v, i) => expect(v).toBeCloseTo(stored[i]!, 6));
    const mid = poseAt(recording, 1, 0.123);
    expect(Math.hypot(...mid.quaternion)).toBeCloseTo(1, 6);
  });
});
