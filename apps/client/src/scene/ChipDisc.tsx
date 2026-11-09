import { useMemo } from "react";
import type { CanvasTexture } from "three";
import { makeLabelTexture } from "./canvasLabel.ts";
import { CHIP_HEIGHT, TOKEN_RADIUS } from "../theme/index.ts";

/** Deep golden yellow: darker than paper, so the chip never glares under the sun or filters. */
export const CHIP_YELLOW = "#ecd9a6";
/** Side and rim colour: an old-gold edge a shade darker than the face. */
const CHIP_RIM = "#9c7b3e";

const papers = new Map<string, CanvasTexture | null>();

/** Circular version of the player cards' .paper surface: warm grain, cream light,
 * leather edge and two fine gold inset rules. One texture per base colour, shared by every
 * chip of that colour (number chips: yellow; resource harbors: their resource tint). */
function paperTexture(base: string) {
  const cached = papers.get(base);
  if (cached !== undefined) return cached;
  const paper = makeLabelTexture((ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const glow = ctx.createRadialGradient(
      size * 0.5,
      size * 0.1,
      0,
      size * 0.5,
      size * 0.3,
      size * 0.85,
    );
    // A soft warm light at the top, kept faint so the face stays golden, not pale.
    glow.addColorStop(0, "rgba(255,246,222,0.4)");
    glow.addColorStop(1, "rgba(160,125,70,0.2)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const grain = ((x * 73 + y * 151 + x * y * 17) % 101) / 101;
        ctx.fillStyle = `rgba(115,84,38,${grain * 0.09})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    for (const [inset, width, color] of [
      [2, 2, "#6e4f1c"],
      [6, 2, "#f6e9c6"],
      [9, 1, "rgba(110,79,28,0.45)"],
    ] as const) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - inset, 0, Math.PI * 2);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  });
  papers.set(base, paper);
  return paper;
}

/** Unlit and matte on every side: the chip keeps one even shade from every camera angle (no
 * sun shading, no highlight), and it is left out of ambient occlusion (PostFx `noAO`). The
 * screen filters' tone mapping and grade still apply, as to the rest of the board. */
export function ChipDisc({ base = CHIP_YELLOW }: { base?: string }) {
  const map = useMemo(() => paperTexture(base), [base]);
  return (
    <mesh position={[0, CHIP_HEIGHT / 2, 0]} userData={{ noAO: true }}>
      <cylinderGeometry args={[TOKEN_RADIUS, TOKEN_RADIUS, CHIP_HEIGHT, 64]} />
      <meshBasicMaterial attach="material-0" color={CHIP_RIM} />
      <meshBasicMaterial attach="material-1" color={map ? "#ffffff" : base} map={map} />
      <meshBasicMaterial attach="material-2" color={CHIP_RIM} />
    </mesh>
  );
}
