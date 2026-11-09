// Two gulls gliding in slow, wide circles over the sea around the island. Pure decoration:
// small, high, off the board, never pickable, and hidden when the player asks for reduced motion.
// The bird is the theme's `prop.gull` model with its own flap animation; with no model mapped
// it is the sketch gull (two "C" arcs) flapping in short bursts.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { useReducedMotion } from "../store/motion.ts";
import { AnimatedAsset, GullWing, useAsset } from "../theme/index.ts";

interface Flight {
  /** Circle radius beyond the island's edge (world units). */
  extra: number;
  height: number;
  /** Seconds per lap; the sign sets the direction. */
  lap: number;
  phase: number;
}

const FLIGHTS: readonly Flight[] = [
  { extra: 1.6, height: 2.3, lap: 70, phase: 0 },
  { extra: 2.4, height: 2.8, lap: -95, phase: 2.4 },
];

/** Wing beats come in short bursts between long glides, like a gull riding the wind. */
function flap(t: number, seed: number): number {
  const cycle = (t + seed * 3.7) % 9;
  if (cycle > 1.6) return 0.08 * Math.sin(t * 0.9 + seed); // glide, slight sway
  return 0.45 * Math.sin(cycle * Math.PI * 2.5);
}

/** The sketch gull, flapping its two arcs. */
function SketchGull({ index }: { index: number }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  useFrame(({ clock }) => {
    const f = flap(clock.getElapsedTime(), index);
    if (left.current) left.current.rotation.z = f;
    if (right.current) right.current.rotation.z = -f;
  });
  return (
    <>
      <group ref={left}>
        <GullWing side={-1} />
      </group>
      <group ref={right}>
        <GullWing side={1} />
      </group>
    </>
  );
}

function Gull({
  flight,
  radius,
  index,
  modelled,
}: {
  flight: Flight;
  radius: number;
  index: number;
  modelled: boolean;
}) {
  const root = useRef<Group>(null);
  const r = radius + flight.extra;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const w = (Math.PI * 2) / flight.lap;
    const a = flight.phase + t * w;
    const g = root.current;
    if (!g) return;
    // A gentle wobble in radius and height keeps the circle from looking mechanical.
    const rr = r + 0.3 * Math.sin(t * 0.13 + index);
    g.position.set(
      rr * Math.cos(a),
      flight.height + 0.15 * Math.sin(t * 0.21 + index),
      rr * Math.sin(a),
    );
    // Heading along the circle's tangent; the bird's nose points along local −Z.
    const vx = -Math.sin(a) * w;
    const vz = Math.cos(a) * w;
    g.rotation.y = Math.atan2(-vx, -vz);
  });

  return (
    <group ref={root}>
      {/* Banked into the turn. */}
      <group rotation={[0, 0, Math.sign(flight.lap) * -0.22]}>
        {modelled ? (
          <AnimatedAsset assetKey="prop.gull" timeOffset={index * 1.7} />
        ) : (
          <SketchGull index={index} />
        )}
      </group>
    </group>
  );
}

/** `land`: land hex centers (x, z), to size the circles just outside the island. */
export function SeaBirds({ land }: { land: readonly (readonly [number, number])[] }) {
  const reduced = useReducedMotion();
  const modelled = useAsset("prop.gull").resolution.kind === "model";
  const radius = useMemo(
    () => land.reduce((m, [x, z]) => Math.max(m, Math.hypot(x, z)), 0) + 1,
    [land],
  );
  if (reduced) return null;
  return (
    <>
      {FLIGHTS.map((f, i) => (
        <Gull key={i} flight={f} radius={radius} index={i} modelled={modelled} />
      ))}
    </>
  );
}
