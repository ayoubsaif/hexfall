// Seeded throw parameters for the physics dice (openspec change physics-dice-3d, design
// decision 3). Derived only from data every client already shares (room code, the roll's
// log index, the die index) plus the retry attempt, so all players throw the same dice.

/** FNV-1a, 32-bit. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small, fast PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ThrowKey {
  room: string;
  /** Position of the roll in the game log. */
  index: number;
  attempt: number;
}

export type Vec3 = [number, number, number];

export interface DieThrow {
  position: Vec3;
  /** Initial orientation as a unit quaternion [x, y, z, w]. */
  quaternion: [number, number, number, number];
  velocity: Vec3;
  spin: Vec3;
}

/** The dice area the throw is aimed into, in its own coordinates (floor at y = 0). */
export interface AreaSize {
  halfX: number;
  halfZ: number;
}

const between = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();

function randomQuaternion(r: () => number): [number, number, number, number] {
  // Shoemake's uniform random rotation.
  const u1 = r();
  const u2 = r() * 2 * Math.PI;
  const u3 = r() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
}

/**
 * Throw parameters for both dice. They enter from the area's −X side, a little above the
 * table, moving toward +X and spinning, one behind the other on Z.
 */
export function throwParams(key: ThrowKey, area: AreaSize): [DieThrow, DieThrow] {
  const r = mulberry32(hashString(`${key.room}|${key.index}|${key.attempt}`));
  const lane = between(r, -0.25, 0.25) * area.halfZ;
  const make = (die: 0 | 1): DieThrow => {
    const z = lane + (die === 0 ? -1 : 1) * area.halfZ * 0.35;
    return {
      position: [-area.halfX + 0.25 + die * 0.12, between(r, 0.55, 0.8), z],
      quaternion: randomQuaternion(r),
      velocity: [between(r, 3.2, 4.4), between(r, -0.5, 0.6), between(r, -0.6, 0.6) - z * 0.6],
      spin: [between(r, -18, 18), between(r, -18, 18), between(r, -18, 18)],
    };
  };
  return [make(0), make(1)];
}
