import { useMemo } from "react";
import type { CanvasTexture } from "three";
import { makeLabelTexture } from "./canvasLabel.ts";
import { CHIP_HEIGHT, TOKEN_RADIUS } from "../theme/index.ts";

export const CHIP_YELLOW = "#fff0a6";

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
    glow.addColorStop(0, "rgba(255,250,235,0.7)");
    glow.addColorStop(1, "rgba(220,199,159,0.45)");
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
      [2, 2, "#876235"],
      [6, 2, "#ecdcbc"],
      [9, 1, "rgba(135,98,53,0.4)"],
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

/** Unlit face keeps the paper colour readable at every camera angle. */
export function ChipDisc({ base = CHIP_YELLOW }: { base?: string }) {
  const map = useMemo(() => paperTexture(base), [base]);
  return (
    <mesh position={[0, CHIP_HEIGHT / 2, 0]}>
      <cylinderGeometry args={[TOKEN_RADIUS, TOKEN_RADIUS, CHIP_HEIGHT, 64]} />
      <meshStandardMaterial attach="material-0" color="#bd963e" roughness={0.8} />
      <meshBasicMaterial
        attach="material-1"
        color={map ? "#ffffff" : base}
        map={map}
        toneMapped={false}
      />
      <meshStandardMaterial attach="material-2" color="#bd963e" roughness={0.8} />
    </mesh>
  );
}
