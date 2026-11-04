// Shared building blocks for procedural fallbacks. All follow the model contract:
// Y-up, 1 unit = hex circumradius. Hexes: pointy-top (corners at ±Z), origin at the
// hex center, top surface at y=0. Pieces/tokens/harbors: origin at base center, on y=0.

export interface FallbackProps {
  /** Owning player's color; only player pieces use it. */
  playerColor?: string | undefined;
}

export const HEX_DEPTH = 0.3;
/** Neutral color for a player piece rendered without an owner. */
export const UNOWNED_COLOR = "#d8d2c4";

export function Mat({ color, roughness = 0.85 }: { color: string; roughness?: number }) {
  return <meshStandardMaterial color={color} roughness={roughness} flatShading />;
}

/**
 * Pointy-top hex prism, circumradius 1, top at y=0. three's CylinderGeometry places
 * vertex i at (sin θ, cos θ) with θ = i·60°, so corners sit on ±Z (pointy-top).
 */
export function HexPrism({ color, rim }: { color: string; rim: string }) {
  return (
    <group>
      <mesh position={[0, -HEX_DEPTH / 2 - 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[1, 1, HEX_DEPTH - 0.04, 6]} />
        <Mat color={rim} />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.96, 1, 0.04, 6]} />
        <Mat color={color} />
      </mesh>
    </group>
  );
}

type Vec3 = [number, number, number];

/** Small cone tree resting on y=0 at (x, z). */
export function Tree({
  at,
  scale = 1,
  color = "#2f6b34",
}: {
  at: [number, number];
  scale?: number;
  color?: string;
}) {
  const p: Vec3 = [at[0], 0, at[1]];
  return (
    <group position={p} scale={scale}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.1, 5]} />
        <Mat color="#6b4a2b" />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <coneGeometry args={[0.11, 0.24, 6]} />
        <Mat color={color} />
      </mesh>
    </group>
  );
}

export function Rock({
  at,
  size,
  color = "#8a8d91",
  y = 0,
}: {
  at: [number, number];
  size: number;
  color?: string;
  y?: number;
}) {
  return (
    <mesh position={[at[0], y + size * 0.5, at[1]]} rotation={[0.4, at[0] * 3, 0.2]} castShadow>
      <dodecahedronGeometry args={[size, 0]} />
      <Mat color={color} />
    </mesh>
  );
}

/** Points on a ring around the hex center, keeping the middle clear for the token. */
export function ring(count: number, radius: number, phase = 0): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const a = phase + (i / count) * Math.PI * 2;
    return [Math.sin(a) * radius, Math.cos(a) * radius] as [number, number];
  });
}
