// What the board dice show, frame by frame (openspec physics-dice-3d, design decisions 1, 2,
// 7 and 8; dice-center-fade, design decision 4). Pure and clock-free so it can be tested
// without WebGL: BoardDice feeds it rolls and frame times and copies the poses and
// visibility onto the scene. The physics planner is injected, so this module never imports
// the physics library.
import type { ThrowMode, ThrowReason } from "../../game/diceThrow.ts";
import type { DiceRoll } from "../../game/status.ts";
import type { DieValue } from "../../theme/die.ts";
import { DIE_SIZE } from "./area.ts";
import { type CubeRotation, remapFor } from "./faces.ts";
import type { Obstacle } from "./obstacles.ts";
import type { DiceThrowPlan, Recording } from "./simulate.ts";

/** Body pose in the dice area's coordinates: position then quaternion [x, y, z, w]. */
export interface Pose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

/** Simulates a throw that lands on `values`, or returns null (show the dice at rest). */
export type Planner = (
  room: string,
  index: number,
  values: readonly [DieValue, DieValue],
  obstacles: readonly Obstacle[],
) => DiceThrowPlan | null;

export interface DiceFrame {
  bodies: [Pose, Pose];
  models: [CubeRotation, CubeRotation];
}

const STEP = 1 / 120;

/** hidden → throwing → resting. Resting dice stay on the table until the next roll. */
export type DicePhase = "hidden" | "throwing" | "resting";
const FLOATS_PER_FRAME = 14;
const UP = [0, 1, 0] as const;
const half = DIE_SIZE / 2;

function yawQuat(angle: number): [number, number, number, number] {
  return [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
}

/** Resting slots for an at-rest display: side by side near the area's middle, slightly turned. */
export const REST_POSES: readonly [Pose, Pose] = [
  { position: [-0.28, half, -0.06], quaternion: yawQuat(0.35) },
  { position: [0.3, half, 0.12], quaternion: yawQuat(-0.22) },
];

const asValues = (dice: readonly [number, number]) => dice as unknown as [DieValue, DieValue];

export function staticFrame(values: readonly [DieValue, DieValue]): DiceFrame {
  return {
    bodies: [clonePose(REST_POSES[0]), clonePose(REST_POSES[1])],
    models: [remapFor(values[0], UP), remapFor(values[1], UP)],
  };
}

function clonePose(p: Pose): Pose {
  return { position: [...p.position], quaternion: [...p.quaternion] };
}

/** Pose of one die at time t (s) of a recording, with interpolation; clamps to the ends. */
export function poseAt(recording: Recording, die: 0 | 1, t: number): Pose {
  const last = recording.frames - 1;
  const f = Math.min(last, Math.max(0, t / STEP));
  const i0 = Math.floor(f);
  const i1 = Math.min(last, i0 + 1);
  const k = f - i0;
  const d = recording.data;
  const a = i0 * FLOATS_PER_FRAME + die * 7;
  const b = i1 * FLOATS_PER_FRAME + die * 7;
  const lerp = (j: number) => d[a + j]! + (d[b + j]! - d[a + j]!) * k;
  const dot =
    d[a + 3]! * d[b + 3]! + d[a + 4]! * d[b + 4]! + d[a + 5]! * d[b + 5]! + d[a + 6]! * d[b + 6]!;
  const s = dot < 0 ? -1 : 1;
  const q = [3, 4, 5, 6].map((j) => d[a + j]! + (s * d[b + j]! - d[a + j]!) * k);
  const len = Math.hypot(q[0]!, q[1]!, q[2]!, q[3]!) || 1;
  return {
    position: [lerp(0), lerp(1), lerp(2)],
    quaternion: [q[0]! / len, q[1]! / len, q[2]! / len, q[3]! / len],
  };
}

export interface RollInput {
  mode: ThrowMode;
  /** Snapshot rolls show no dice; reduced motion shows them at rest. */
  reason: ThrowReason;
  /** Latest roll of the current turn, or null before it. */
  roll: DiceRoll | null;
  room: string;
  /** Board pieces the dice collide with (see obstacles.ts); empty for none. */
  obstacles?: readonly Obstacle[];
  /** Null while the physics code is loading or after it failed to load. */
  planner: Planner | null;
}

export interface RollOutcome {
  /** Roll index whose dice are already at rest (static display), or null. */
  settled: number | null;
  /** True when a throw started playing. */
  throwing: boolean;
}

/**
 * Holds the dice's current frame and visibility. `roll()` is called once per new throw
 * decision (a new roll, or the first mount); `tick(seconds)` advances a throw. Once at rest
 * the dice stay on the table, through later turns, until the next roll replaces them.
 */
export class DiceController {
  frame: DiceFrame = staticFrame([1, 1]);
  phase: DicePhase = "hidden";
  private plan: { recording: Recording; index: number; duration: number } | null = null;
  /** Clock time the current phase started, set on its first tick. */
  private start: number | null = null;

  get visible(): boolean {
    return this.phase !== "hidden";
  }

  /** True while frames still change (during a throw). */
  get playing(): boolean {
    return this.phase === "throwing";
  }

  private enter(phase: DicePhase): void {
    this.phase = phase;
    this.start = null;
  }

  roll(input: RollInput): RollOutcome {
    const { roll } = input;
    if (!roll) {
      // A new turn before its roll: the last dice stay where they are.
      return { settled: null, throwing: false };
    }
    const values = asValues(roll.dice);
    this.plan = null;
    if (input.mode === "animate" && input.planner) {
      let plan: DiceThrowPlan | null = null;
      try {
        plan = input.planner(input.room, roll.index, values, input.obstacles ?? []);
      } catch {
        plan = null;
      }
      if (plan) {
        this.plan = {
          recording: plan.recording,
          index: roll.index,
          duration: (plan.recording.frames - 1) * STEP,
        };
        this.frame = {
          bodies: [poseAt(plan.recording, 0, 0), poseAt(plan.recording, 1, 0)],
          models: plan.models,
        };
        this.enter("throwing");
        return { settled: null, throwing: true };
      }
    }
    this.frame = staticFrame(values);
    // A snapshot (join, resume) shows no board dice; anything else rests on the table.
    this.enter(input.reason === "snapshot" ? "hidden" : "resting");
    return { settled: roll.index, throwing: false };
  }

  /**
   * Advances to wall-clock time `now` (s). Returns the roll index when a throw has just come
   * to rest, else null. The model rotations never change during a throw.
   */
  tick(now: number): number | null {
    if (this.phase === "hidden") return null;
    if (this.start === null) this.start = now;
    const t = now - this.start;
    if (this.phase === "throwing" && this.plan) {
      const { recording, index, duration } = this.plan;
      this.frame = {
        bodies: [poseAt(recording, 0, t), poseAt(recording, 1, t)],
        models: this.frame.models,
      };
      if (t < duration) return null;
      this.plan = null;
      this.enter("resting");
      return index;
    }
    return null;
  }
}
