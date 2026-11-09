// Procedural sea gull (`prop.gull`): a sketch bird of two thin "C" arcs meeting at the middle,
// lying flat and bowed toward the nose (−Z). Origin at the bird's centre. The sea birds also
// flap these wings themselves when no gull model is mapped.

/** One wing: an arc of a circle starting WING_START past its side, as far short of the other. */
const RADIUS = 0.1;
const START = 0.5;
export const GULL_WING = {
  radius: RADIUS,
  start: START,
  arc: Math.PI - 2 * START,
  chord: 2 * RADIUS * Math.cos(START),
  tube: 0.007,
  color: "#2f3438",
} as const;

const noRaycast = () => undefined;

/** One wing (side −1 = left, 1 = right), its inner end on the origin. */
export function GullWing({ side }: { side: -1 | 1 }) {
  const w = GULL_WING;
  return (
    <mesh
      position={[side * w.chord * 0.5, 0, w.radius * Math.sin(w.start)]}
      rotation={[-Math.PI / 2, 0, w.start]}
      raycast={noRaycast}
    >
      <torusGeometry args={[w.radius, w.tube, 4, 18, w.arc]} />
      <meshStandardMaterial color={w.color} roughness={0.9} />
    </mesh>
  );
}

export function GullPiece() {
  return (
    <group>
      <GullWing side={-1} />
      <GullWing side={1} />
    </group>
  );
}
