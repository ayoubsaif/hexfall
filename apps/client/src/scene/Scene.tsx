// Debug scene (asset-theming 6.3/6.5/6.6): renders every asset key through the theme
// layer. The real board replaces this in a later change.
import { OrbitControls } from "@react-three/drei";
import { Asset, type AssetKey } from "../theme/index.ts";

type XZ = [number, number];

const SQRT3 = Math.sqrt(3);
const PLAYER_COLORS = ["#d64541", "#3a7bd5", "#f2f2f2", "#f39c12"] as const;

/** Pointy-top axial (q, r) -> world XZ, 1 unit = circumradius. */
function hexToWorld(q: number, r: number): XZ {
  return [SQRT3 * (q + r / 2), 1.5 * r];
}

/** Corner i of a pointy-top hex (matches the fallback prism: corner 0 at +Z). */
function corner([x, z]: XZ, i: number): XZ {
  const a = (i * Math.PI) / 3;
  return [x + Math.sin(a), z + Math.cos(a)];
}

const AXIAL_DIRS: XZ[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

const LAND: { key: AssetKey; at: XZ }[] = [
  { key: "tile.desert", at: [0, 0] },
  { key: "tile.forest", at: [1, 0] },
  { key: "tile.pasture", at: [1, -1] },
  { key: "tile.fields", at: [0, -1] },
  { key: "tile.hills", at: [-1, 0] },
  { key: "tile.mountains", at: [-1, 1] },
  { key: "tile.forest", at: [0, 1] },
];

// Ring-2 hexes are sea; every second one carries a harbor facing the center.
const SEA: XZ[] = [];
for (let side = 0; side < 6; side++) {
  const [dq, dr] = AXIAL_DIRS[side] ?? [0, 0];
  const [nq, nr] = AXIAL_DIRS[(side + 2) % 6] ?? [0, 0];
  for (let step = 0; step < 2; step++) SEA.push([2 * dq + step * nq, 2 * dr + step * nr]);
}
const HARBORS: AssetKey[] = [
  "harbor.generic",
  "harbor.brick",
  "harbor.grain",
  "harbor.lumber",
  "harbor.ore",
  "harbor.wool",
];

/** The two outermost corners of a ring-1 hex: never shared with another land hex. */
function outerCorners(center: XZ): [XZ, XZ] {
  const corners = [0, 1, 2, 3, 4, 5].map((i) => corner(center, i));
  corners.sort((p, q) => Math.hypot(...q) - Math.hypot(...p));
  return [corners[0] ?? center, corners[1] ?? center];
}

function PlayerPieces({ hex, color }: { hex: XZ; color: string }) {
  const [a, b] = outerCorners(hexToWorld(...hex));
  const mid: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const roadYaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  return (
    <>
      <group position={[a[0], 0, a[1]]}>
        <Asset assetKey="piece.settlement" playerColor={color} />
      </group>
      <group position={[mid[0], 0, mid[1]]} rotation={[0, roadYaw, 0]}>
        <Asset assetKey="piece.road" playerColor={color} />
      </group>
      <group position={[b[0], 0, b[1]]}>
        <Asset assetKey="piece.city" playerColor={color} />
      </group>
    </>
  );
}

export function Scene() {
  return (
    <>
      <color attach="background" args={["#bfe3f2"]} />
      <hemisphereLight args={["#fff6e5", "#4a6a7a", 0.8]} />
      <directionalLight
        position={[6, 12, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#2a6f9e" />
      </mesh>

      {LAND.map(({ key, at }, i) => {
        const [x, z] = hexToWorld(...at);
        return (
          <group key={i} position={[x, 0, z]}>
            <Asset assetKey={key} />
            {key !== "tile.desert" && <Asset assetKey="token" />}
          </group>
        );
      })}
      {(() => {
        const [x, z] = hexToWorld(0, 0);
        return (
          <group position={[x, 0, z]}>
            <Asset assetKey="piece.robber" />
          </group>
        );
      })()}

      {SEA.map((at, i) => {
        const [x, z] = hexToWorld(...at);
        const harbor = i % 2 === 0 ? HARBORS[i / 2] : undefined;
        // Dock points along local -Z; turn it toward the board center.
        const yaw = Math.atan2(x, z);
        return (
          <group key={i} position={[x, 0, z]}>
            <Asset assetKey="sea" />
            {harbor && (
              <group rotation={[0, yaw, 0]}>
                <Asset assetKey={harbor} />
              </group>
            )}
          </group>
        );
      })}

      {/* One shared model per piece key, tinted in four player colors. */}
      <PlayerPieces hex={[1, 0]} color={PLAYER_COLORS[0]} />
      <PlayerPieces hex={[0, -1]} color={PLAYER_COLORS[1]} />
      <PlayerPieces hex={[-1, 0]} color={PLAYER_COLORS[2]} />
      <PlayerPieces hex={[0, 1]} color={PLAYER_COLORS[3]} />

      <OrbitControls
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={3}
        maxDistance={25}
      />
    </>
  );
}
