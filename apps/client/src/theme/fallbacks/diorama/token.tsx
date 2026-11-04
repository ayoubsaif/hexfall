// Number-token base: a flat disc resting on y=0. Numbers are drawn by the board later.
import { Mat } from "./common.tsx";

export function TokenPiece() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.3, 0.04, 16]} />
        <Mat color="#f1e6c8" />
      </mesh>
      <mesh position={[0, 0.0405, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.23, 16]} />
        <meshStandardMaterial color="#b9a274" />
      </mesh>
    </group>
  );
}
