// Headless physics for one dice throw (openspec change physics-dice-3d, design decisions
// 1, 2 and 8). The whole throw is simulated before any frame is shown, recorded per step,
// and the die models are remapped so the side that lands up shows the server's value.
// Pure: no React, no DOM, no clock.
import { Body, Box, ContactMaterial, Cylinder, Material, Plane, Vec3, World } from "cannon-es";
import { THROW_MS } from "../../game/diceThrow.ts";
import type { DieValue } from "../../theme/die.ts";
import { type CubeRotation, remapFor, upAxis } from "./faces.ts";
import type { Obstacle } from "./obstacles.ts";
import { type AreaSize, type ThrowKey, throwParams } from "./seed.ts";

/** Fixed simulation step (s). */
export const STEP = 1 / 120;
/** Longest throw simulated (s); a throw that has not settled by then is retried. */
export const MAX_SECONDS = THROW_MS / 1000;
/** Largest tilt from flat a resting die may have (radians). */
export const MAX_TILT = (15 * Math.PI) / 180;
/** Tries before giving up and showing the dice at rest. */
export const MAX_ATTEMPTS = 8;

/** The dice area, in its own coordinates (floor at y = 0, centered on the origin). */
export { DICE_AREA } from "./area.ts";
import { DICE_AREA, DIE_SIZE } from "./area.ts";

const GRAVITY = -22;
const WALL_HEIGHT = 3;

/**
 * A recorded throw: per step, for each die, position (3) and quaternion (4), i.e.
 * 14 floats per frame. `frames` counts frames; the last one is the resting pose.
 */
export interface Recording {
  frames: number;
  data: Float32Array;
}

export interface SimResult {
  recording: Recording;
  /** Whether both dice came to rest flat before MAX_SECONDS. */
  settled: boolean;
  /** Final orientation of each die's body. */
  rest: [Quat, Quat];
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export const FLOATS_PER_FRAME = 14;

/** Runs one attempt. `obstacles` are the board pieces the dice bump into (static bodies). */
export function simulate(
  key: ThrowKey,
  area: AreaSize = DICE_AREA,
  obstacles: readonly Obstacle[] = [],
): SimResult {
  const world = new World({ gravity: new Vec3(0, GRAVITY, 0), allowSleep: true });
  const table = new Material("table");
  const wall = new Material("wall");
  const dieMat = new Material("die");
  world.addContactMaterial(
    new ContactMaterial(table, dieMat, { friction: 0.35, restitution: 0.32 }),
  );
  world.addContactMaterial(new ContactMaterial(wall, dieMat, { friction: 0.1, restitution: 0.5 }));
  world.addContactMaterial(
    new ContactMaterial(dieMat, dieMat, { friction: 0.2, restitution: 0.35 }),
  );
  const piece = new Material("piece");
  world.addContactMaterial(new ContactMaterial(piece, dieMat, { friction: 0.3, restitution: 0.3 }));

  const floor = new Body({ mass: 0, material: table, shape: new Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  // Four walls, each a plane facing into the area.
  const walls: [number, number, number, number][] = [
    // [x, z, yaw about Y so the plane normal (+Z) points inward]
    [-area.halfX, 0, Math.PI / 2, 0],
    [area.halfX, 0, -Math.PI / 2, 0],
    [0, -area.halfZ, 0, 0],
    [0, area.halfZ, Math.PI, 0],
  ];
  for (const [x, z, yaw] of walls) {
    const b = new Body({ mass: 0, material: wall, shape: new Plane() });
    b.position.set(x, WALL_HEIGHT / 2, z);
    b.quaternion.setFromEuler(0, yaw, 0);
    world.addBody(b);
  }

  for (const o of obstacles) {
    const shape =
      o.shape === "box"
        ? new Box(new Vec3(...o.half))
        : new Cylinder(o.radius, o.radius, o.height, 12);
    const b = new Body({ mass: 0, material: piece, shape });
    b.position.set(...o.position);
    if (o.shape === "box") b.quaternion.setFromEuler(0, o.yaw, 0);
    world.addBody(b);
  }

  const half = DIE_SIZE / 2;
  const params = throwParams(key, area);
  const dice = params.map((p) => {
    const b = new Body({
      mass: 1,
      material: dieMat,
      shape: new Box(new Vec3(half, half, half)),
      linearDamping: 0.08,
      angularDamping: 0.12,
      sleepSpeedLimit: 0.08,
      sleepTimeLimit: 0.25,
    });
    b.position.set(...p.position);
    b.quaternion.set(...p.quaternion);
    b.velocity.set(...p.velocity);
    b.angularVelocity.set(...p.spin);
    world.addBody(b);
    return b;
  });

  const maxFrames = Math.round(MAX_SECONDS / STEP) + 1;
  const data = new Float32Array(maxFrames * FLOATS_PER_FRAME);
  let frames = 0;
  const record = () => {
    const o = frames * FLOATS_PER_FRAME;
    dice.forEach((b, i) => {
      const at = o + i * 7;
      data[at] = b.position.x;
      data[at + 1] = b.position.y;
      data[at + 2] = b.position.z;
      data[at + 3] = b.quaternion.x;
      data[at + 4] = b.quaternion.y;
      data[at + 5] = b.quaternion.z;
      data[at + 6] = b.quaternion.w;
    });
    frames++;
  };
  record();
  let asleep = false;
  while (frames < maxFrames) {
    world.step(STEP);
    record();
    if (dice.every((b) => b.sleepState === Body.SLEEPING)) {
      asleep = true;
      break;
    }
  }
  const rest = dice.map((b) => ({
    x: b.quaternion.x,
    y: b.quaternion.y,
    z: b.quaternion.z,
    w: b.quaternion.w,
  })) as [Quat, Quat];
  const flat = rest.every((q) => upAxis(q).tilt <= MAX_TILT);
  return {
    recording: { frames, data: data.slice(0, frames * FLOATS_PER_FRAME) },
    settled: asleep && flat,
    rest,
  };
}

export interface DiceThrowPlan {
  recording: Recording;
  /** Fixed rotation of each die model inside its body. */
  models: [CubeRotation, CubeRotation];
  attempt: number;
}

/**
 * Simulates a throw that lands on `values`: up to MAX_ATTEMPTS tries, then null (the caller
 * shows the dice at rest). The values never depend on the simulation.
 */
export function planThrow(
  room: string,
  index: number,
  values: readonly [DieValue, DieValue],
  obstacles: readonly Obstacle[] = [],
  area: AreaSize = DICE_AREA,
  sim: typeof simulate = simulate,
): DiceThrowPlan | null {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = sim({ room, index, attempt }, area, obstacles);
    if (!result.settled) continue;
    return {
      recording: result.recording,
      models: [
        remapFor(values[0], upAxis(result.rest[0]).axis),
        remapFor(values[1], upAxis(result.rest[1]).axis),
      ],
      attempt,
    };
  }
  return null;
}

/** Duration of a recording in seconds. */
export function recordingSeconds(recording: Recording): number {
  return (recording.frames - 1) * STEP;
}
