// A wooden pier: planked deck on mooring posts, lying on the sea and running from the group's
// origin along (dx, dz). Procedural (one textured box and four posts), so nothing to download.
// The harbor draws two, one toward each of its slot's intersections.
import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

const WOOD = "#a67a45";
const WOOD_DARK = "#5e3d22";
const WIDTH = 0.16;
/** Deck height above the sea surface, and the thickness of the deck. */
const DECK_Y = 0.09;
const DECK_THICKNESS = 0.035;
const POST_HEIGHT = 0.2;

let plankTexture: CanvasTexture | null | undefined;

/** Planks across a pier (seams every 1/6 of its length). Null without a 2D canvas (tests). */
function planks(): CanvasTexture | null {
  if (plankTexture !== undefined) return plankTexture;
  plankTexture = null;
  if (typeof document === "undefined") return plankTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 48;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return plankTexture;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const shade = 0.9 + ((i * 37) % 7) / 35;
    ctx.fillStyle = `rgb(${Math.round(166 * shade)} ${Math.round(122 * shade)} ${Math.round(69 * shade)})`;
    ctx.fillRect((i * canvas.width) / n, 0, canvas.width / n, canvas.height);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect((i * canvas.width) / n, 0, 3, canvas.height);
  }
  ctx.fillStyle = "rgb(94 61 34 / 55%)";
  ctx.fillRect(0, 0, canvas.width, 3);
  ctx.fillRect(0, canvas.height - 3, canvas.width, 3);
  plankTexture = new CanvasTexture(canvas);
  plankTexture.colorSpace = SRGBColorSpace;
  return plankTexture;
}

export function HarborDock({ dx, dz, seaLevel }: { dx: number; dz: number; seaLevel: number }) {
  const length = Math.hypot(dx, dz);
  const map = useMemo(planks, []);
  const posts = [0.1, 0.5, 0.9];
  return (
    <group position={[dx / 2, seaLevel, dz / 2]} rotation={[0, Math.atan2(-dz, dx), 0]}>
      <mesh position={[0, DECK_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, DECK_THICKNESS, WIDTH]} />
        <meshStandardMaterial color={map ? "#ffffff" : WOOD} map={map} roughness={0.95} />
      </mesh>
      {posts.flatMap((t) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${t},${side}`}
            position={[(t - 0.5) * length, DECK_Y + POST_HEIGHT / 2 - 0.1, (side * WIDTH) / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.02, 0.024, POST_HEIGHT, 7]} />
            <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
}
