// Harbors: a small dock (origin at base center, on y=0) with a resource-colored flag and
// cargo prop, so each harbor type is distinct. The dock points along local -Z.
import type { ReactNode } from "react";
import { Mat, Rock } from "./common.tsx";

function Dock({ flag, children }: { flag: string; children: ReactNode }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.04, 0.3]} />
        <Mat color="#8a6a45" />
      </mesh>
      <mesh position={[0, 0.02, -0.3]} castShadow>
        <boxGeometry args={[0.14, 0.03, 0.32]} />
        <Mat color="#7a5c3b" />
      </mesh>
      <mesh position={[0.2, 0.2, 0.1]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 5]} />
        <Mat color="#5b4430" />
      </mesh>
      <mesh position={[0.28, 0.32, 0.1]} castShadow>
        <boxGeometry args={[0.16, 0.1, 0.01]} />
        <Mat color={flag} />
      </mesh>
      <group position={[-0.08, 0.04, 0.03]}>{children}</group>
    </group>
  );
}

export function GenericHarbor() {
  const colors = ["#c4683f", "#e3c35a", "#3f7d3a", "#8b8f96", "#f4f1e8"];
  return (
    <Dock flag="#ffffff">
      {colors.map((c, i) => (
        <mesh key={c} position={[-0.1 + i * 0.05, 0.04, 0]} castShadow>
          <boxGeometry args={[0.04, 0.08, 0.1]} />
          <Mat color={c} />
        </mesh>
      ))}
    </Dock>
  );
}

export function BrickHarbor() {
  return (
    <Dock flag="#c4683f">
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[(i - 1) * 0.07 + (i === 2 ? -0.035 : 0), i === 2 ? 0.075 : 0.025, 0]}
          castShadow
        >
          <boxGeometry args={[0.065, 0.05, 0.1]} />
          <Mat color="#a9502d" />
        </mesh>
      ))}
    </Dock>
  );
}

export function GrainHarbor() {
  return (
    <Dock flag="#e3c35a">
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.07, 0.16, 6]} />
        <Mat color="#d9a92b" />
      </mesh>
    </Dock>
  );
}

export function LumberHarbor() {
  return (
    <Dock flag="#3f7d3a">
      {[-0.05, 0, 0.05].map((x, i) => (
        <mesh
          key={i}
          position={[x, i === 1 ? 0.07 : 0.03, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.028, 0.028, 0.18, 6]} />
          <Mat color="#7a5230" />
        </mesh>
      ))}
    </Dock>
  );
}

export function OreHarbor() {
  return (
    <Dock flag="#5f6670">
      <Rock at={[-0.03, 0]} size={0.055} color="#6f737a" />
      <Rock at={[0.05, 0.02]} size={0.04} color="#8b8f96" />
    </Dock>
  );
}

export function WoolHarbor() {
  return (
    <Dock flag="#9ccc65">
      <mesh position={[0, 0.06, 0]} castShadow>
        <icosahedronGeometry args={[0.07, 1]} />
        <Mat color="#f4f1e8" />
      </mesh>
    </Dock>
  );
}
