// Procedural die for `dice.die`: a rounded red cube with white pips, centered on its origin
// with the values on the contract axes (theme/die.ts), so it can stand in for the GLB.
import { RoundedBox } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import { DIE_BODY_COLOR, DIE_EDGE, DIE_PIP_COLOR, DIE_VALUES, pipPositions } from "../die.ts";

const UP = new Vector3(0, 1, 0);
const PIP_RADIUS = DIE_EDGE * 0.09;

const PIPS = DIE_VALUES.flatMap((value) =>
  pipPositions(value).map((pip, i) => ({
    key: `${value}-${i}`,
    position: pip.position,
    quaternion: new Quaternion().setFromUnitVectors(UP, new Vector3(...pip.normal)),
  })),
);

export function DiePiece() {
  return (
    <group>
      <RoundedBox args={[DIE_EDGE, DIE_EDGE, DIE_EDGE]} radius={DIE_EDGE * 0.14} smoothness={3} castShadow>
        <meshStandardMaterial color={DIE_BODY_COLOR} roughness={0.35} />
      </RoundedBox>
      {PIPS.map((p) => (
        <mesh key={p.key} position={p.position} quaternion={p.quaternion}>
          <cylinderGeometry args={[PIP_RADIUS, PIP_RADIUS, 0.004, 16]} />
          <meshStandardMaterial color={DIE_PIP_COLOR} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
