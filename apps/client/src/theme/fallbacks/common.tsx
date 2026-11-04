// Shared building blocks for procedural fallbacks. All follow the coordinate contract:
// Y-up, 1 unit = hex circumradius. Flat keys are drawn by ../flat.tsx; 3D pieces have
// their origin at the base center, resting on y=0.

export interface FallbackProps {
  /** Owning player's color; only player pieces use it. */
  playerColor?: string | undefined;
}

/** Neutral color for a player piece rendered without an owner. */
export const UNOWNED_COLOR = "#d8d2c4";

export function Mat({ color, roughness = 0.85 }: { color: string; roughness?: number }) {
  return <meshStandardMaterial color={color} roughness={roughness} flatShading />;
}
