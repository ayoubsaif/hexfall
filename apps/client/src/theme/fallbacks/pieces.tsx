// Procedural player pieces (tinted with the owner's color) and the robber (never tinted).
// Origin at base center, resting on y=0. Roads lie along local X (one hex edge = 1 unit).
import { type FallbackProps, Mat, UNOWNED_COLOR } from "./common.tsx";

export function RoadPiece({ playerColor }: FallbackProps) {
  return (
    <mesh position={[0, 0.05, 0]} castShadow>
      <boxGeometry args={[0.72, 0.1, 0.11]} />
      <Mat color={playerColor ?? UNOWNED_COLOR} />
    </mesh>
  );
}

function House({ color, w, d, h }: { color: string; w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <Mat color={color} />
      </mesh>
      {/* Hip roof: a square pyramid stretched to the footprint. */}
      <group position={[0, h + h * 0.35, 0]} scale={[1, 1, d / w]}>
        <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[w * 0.78, h * 0.7, 4]} />
          <Mat color={color} />
        </mesh>
      </group>
    </group>
  );
}

export function SettlementPiece({ playerColor }: FallbackProps) {
  return <House color={playerColor ?? UNOWNED_COLOR} w={0.2} d={0.18} h={0.14} />;
}

export function CityPiece({ playerColor }: FallbackProps) {
  const color = playerColor ?? UNOWNED_COLOR;
  return (
    <group>
      <mesh position={[0.05, 0.07, 0]} castShadow>
        <boxGeometry args={[0.36, 0.14, 0.22]} />
        <Mat color={color} />
      </mesh>
      <group position={[-0.08, 0.14, 0]}>
        <House color={color} w={0.18} d={0.2} h={0.14} />
      </group>
    </group>
  );
}

export function RobberPiece() {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.13, 0.06, 8]} />
        <Mat color="#2b2b30" />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 0.28, 8]} />
        <Mat color="#3a3a42" />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <icosahedronGeometry args={[0.08, 0]} />
        <Mat color="#3a3a42" />
      </mesh>
    </group>
  );
}
