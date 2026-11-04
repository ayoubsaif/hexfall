// Procedural terrain and sea hexes. Each terrain has its own color pair and props.
import { HexPrism, Mat, Rock, Tree, ring } from "./common.tsx";

export function ForestTile() {
  return (
    <group>
      <HexPrism color="#3f7d3a" rim="#4a3a28" />
      {ring(7, 0.62, 0.3).map((at, i) => (
        <Tree key={i} at={at} scale={0.9 + (i % 3) * 0.15} color={i % 2 ? "#2c5f2d" : "#3b7a3c"} />
      ))}
    </group>
  );
}

export function PastureTile() {
  return (
    <group>
      <HexPrism color="#9ccc65" rim="#5d7a3a" />
      {ring(4, 0.6, 0.6).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 1.3, 0]}>
          <mesh position={[0, 0.07, 0]} castShadow>
            <boxGeometry args={[0.13, 0.08, 0.08]} />
            <Mat color="#f4f1e8" />
          </mesh>
          <mesh position={[0.08, 0.09, 0]} castShadow>
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <Mat color="#3a3330" />
          </mesh>
        </group>
      ))}
      {ring(3, 0.72, 0).map(([x, z], i) => (
        <mesh key={`b${i}`} position={[x, 0.04, z]} castShadow>
          <icosahedronGeometry args={[0.07, 0]} />
          <Mat color="#6e9e3f" />
        </mesh>
      ))}
    </group>
  );
}

export function FieldsTile() {
  const rows = [-0.6, -0.45, -0.3, 0.3, 0.45, 0.6];
  return (
    <group>
      <HexPrism color="#e3c35a" rim="#8a6d2e" />
      {rows.map((x) => (
        <mesh key={x} position={[x, 0.035, 0]} castShadow>
          <boxGeometry args={[0.08, 0.07, 1.6 - Math.abs(x) * 1.6]} />
          <Mat color="#d9a92b" />
        </mesh>
      ))}
    </group>
  );
}

export function HillsTile() {
  return (
    <group>
      <HexPrism color="#c4683f" rim="#6e3a24" />
      {ring(3, 0.58, 0.5).map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} scale={[1, 0.55, 1]} castShadow>
          <sphereGeometry args={[0.22, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat color={i % 2 ? "#a9502d" : "#b85c36"} />
        </mesh>
      ))}
      {ring(3, 0.62, 1.55).map(([x, z], i) => (
        <mesh key={`k${i}`} position={[x, 0.04, z]} rotation={[0, i, 0]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.07]} />
          <Mat color="#8f3b22" />
        </mesh>
      ))}
    </group>
  );
}

export function MountainsTile() {
  const peaks: { at: [number, number]; h: number; r: number }[] = [
    { at: [0.42, -0.35], h: 0.55, r: 0.28 },
    { at: [-0.45, -0.25], h: 0.42, r: 0.24 },
    { at: [0.05, 0.6], h: 0.36, r: 0.22 },
  ];
  return (
    <group>
      <HexPrism color="#8b8f96" rim="#4f5258" />
      {peaks.map(({ at, h, r }, i) => (
        <group key={i} position={[at[0], 0, at[1]]}>
          <mesh position={[0, h / 2, 0]} castShadow>
            <coneGeometry args={[r, h, 5]} />
            <Mat color="#6f737a" />
          </mesh>
          <mesh position={[0, h * 0.85, 0]}>
            <coneGeometry args={[r * 0.3, h * 0.3, 5]} />
            <Mat color="#f2f4f7" />
          </mesh>
        </group>
      ))}
      <Rock at={[-0.6, 0.35]} size={0.08} />
    </group>
  );
}

export function DesertTile() {
  return (
    <group>
      <HexPrism color="#ead6a0" rim="#b49a5e" />
      {ring(2, 0.58, 0.9).map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} scale={[1.6, 0.35, 1]} castShadow>
          <sphereGeometry args={[0.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat color="#dcc285" />
        </mesh>
      ))}
      <group position={[-0.55, 0, -0.3]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.04, 0.24, 6]} />
          <Mat color="#5f8f4a" />
        </mesh>
        <mesh position={[0.06, 0.14, 0]} rotation={[0, 0, -0.9]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.1, 5]} />
          <Mat color="#5f8f4a" />
        </mesh>
      </group>
      <Rock at={[0.5, -0.45]} size={0.06} color="#b8a477" />
    </group>
  );
}

export function SeaTile() {
  return (
    <group>
      <HexPrism color="#2f86c2" rim="#1f5f8f" />
      {ring(3, 0.5, 0.4).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.06, 0.09, 8, 1, 0, Math.PI]} />
          <meshStandardMaterial color="#9fd3f2" />
        </mesh>
      ))}
    </group>
  );
}
