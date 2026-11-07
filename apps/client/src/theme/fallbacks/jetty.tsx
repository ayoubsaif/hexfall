// Procedural harbor jetty (`prop.jetty`): a slab of stylized cartoon rock on squat stone
// pillars, lying on the sea. It follows the jetty contract: origin at the coastal edge midpoint
// at land-top height, running JETTY_LENGTH out to sea along +X. The stone is drawn procedurally
// (rounded grey slabs, warm dark gaps, light rims, hairline cracks), so nothing to download.
import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { useLandRelief } from "../useLandRelief.ts";

const STONE = "#9aa0a8";
const STONE_DARK = "#5d626b";
const WIDTH = 0.64;
/** Length of the jetty from the coastal edge out to its sea end. */
export const JETTY_LENGTH = 0.36;
/** Deck height above the sea surface, and the thickness of the deck. */
const DECK_Y = 0.09;
const DECK_THICKNESS = 0.035;
const PILLAR_HEIGHT = 0.2;

/** Texture size: the deck is about twice as long as it is wide. */
const TEX_W = 256;
const TEX_H = 128;
const SLABS = 22;

export interface StoneMaps {
  color: CanvasTexture;
  bump: CanvasTexture;
}

let stone: StoneMaps | null | undefined;

/** Small deterministic generator, so every pier and every reload looks the same. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Cartoon rock: Voronoi slabs (nearest / second-nearest distance, wrapping so the edges tile).
 * Gaps between slabs are dark and warm, each slab gets a light rim just inside its edge and a
 * soft dome, and a few dark hairline cracks run across the slabs. Null without a 2D canvas.
 */
function stoneMaps(): StoneMaps | null {
  if (stone !== undefined) return stone;
  stone = null;
  if (typeof document === "undefined") return stone;
  const make = () => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = c.getContext("2d");
    } catch {
      ctx = null;
    }
    return { c, ctx };
  };
  const color = make();
  const bump = make();
  if (!color.ctx || !bump.ctx) return stone;

  const rand = rng(581);
  const pts = Array.from({ length: SLABS }, () => ({
    x: rand() * TEX_W,
    y: rand() * TEX_H,
    tone: 0.86 + rand() * 0.22,
    warm: rand() * 0.06,
  }));
  const img = color.ctx.createImageData(TEX_W, TEX_H);
  const hgt = bump.ctx.createImageData(TEX_W, TEX_H);
  for (let y = 0; y < TEX_H; y++) {
    for (let x = 0; x < TEX_W; x++) {
      let f1 = Infinity;
      let f2 = Infinity;
      let near = pts[0]!;
      let nx = 0;
      let ny = 0;
      for (const p of pts) {
        // Wrap so the texture tiles along both axes.
        let ddx = Math.abs(x - p.x);
        let ddy = Math.abs(y - p.y);
        ddx = Math.min(ddx, TEX_W - ddx);
        ddy = Math.min(ddy, TEX_H - ddy);
        const d = Math.hypot(ddx, ddy);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          near = p;
          nx = x - p.x;
          ny = y - p.y;
        } else if (d < f2) f2 = d;
      }
      const edge = f2 - f1;
      const gap = 1 - smooth(0.8, 2.4, edge);
      const rim = smooth(1.8, 3.2, edge) * (1 - smooth(3.2, 7, edge));
      const dome = 1 - Math.min(1, f1 / 34);
      // Light from the upper left: slab faces tilted toward it read lighter.
      const lit = 0.9 + 0.14 * Math.max(-1, Math.min(1, (-nx - ny) / 30));
      const g = (138 + 26 * dome) * near.tone * lit + rim * 52;
      let r = g + near.warm * 120;
      let gg = g + 3;
      let b = g + 12;
      // Warm dirt in the gaps.
      r = r * (1 - gap) + 86 * gap;
      gg = gg * (1 - gap) + 72 * gap;
      b = b * (1 - gap) + 60 * gap;
      const o = (y * TEX_W + x) * 4;
      img.data[o] = Math.min(255, r);
      img.data[o + 1] = Math.min(255, gg);
      img.data[o + 2] = Math.min(255, b);
      img.data[o + 3] = 255;
      const h = 255 * (1 - gap) * (0.55 + 0.45 * dome);
      hgt.data[o] = hgt.data[o + 1] = hgt.data[o + 2] = h;
      hgt.data[o + 3] = 255;
    }
  }
  color.ctx.putImageData(img, 0, 0);
  bump.ctx.putImageData(hgt, 0, 0);

  // Hairline cracks: short branching strokes, dark on the colour map and cut into the height.
  for (const ctx of [color.ctx, bump.ctx]) {
    const crack = rng(77);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < 9; i++) {
      let x = crack() * TEX_W;
      let y = crack() * TEX_H;
      let a = crack() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 3 + Math.floor(crack() * 4);
      for (let s = 0; s < steps; s++) {
        a += (crack() - 0.5) * 1.4;
        x += Math.cos(a) * (4 + crack() * 6);
        y += Math.sin(a) * (4 + crack() * 6);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = ctx === color.ctx ? "rgb(52 48 46 / 70%)" : "rgb(0 0 0 / 80%)";
      ctx.lineWidth = 1 + crack() * 0.8;
      ctx.stroke();
    }
  }

  const colorTex = new CanvasTexture(color.c);
  colorTex.colorSpace = SRGBColorSpace;
  colorTex.anisotropy = 4;
  const bumpTex = new CanvasTexture(bump.c);
  stone = { color: colorTex, bump: bumpTex };
  return stone;
}

export function JettyPiece() {
  // On a raised island the sea sits lower than the land top, and the deck lies on the sea.
  const { seaLevel } = useLandRelief();
  const length = JETTY_LENGTH;
  const maps = useMemo(stoneMaps, []);
  const pillars = [0.2, 0.8];
  return (
    <group position={[length / 2, seaLevel, 0]}>
      <mesh position={[0, DECK_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, DECK_THICKNESS, WIDTH]} />
        <meshStandardMaterial
          color={maps ? "#ffffff" : STONE}
          map={maps?.color ?? null}
          bumpMap={maps?.bump ?? null}
          bumpScale={2.2}
          roughness={0.88}
        />
      </mesh>
      {pillars.flatMap((t) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${t},${side}`}
            position={[
              (t - 0.5) * length,
              // Under the deck, reaching down into the sea.
              DECK_Y - DECK_THICKNESS / 2 - PILLAR_HEIGHT / 2,
              (side * (WIDTH - 0.05)) / 2,
            ]}
            rotation={[0, t * 2.1 + side, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.034, 0.044, PILLAR_HEIGHT, 6]} />
            <meshStandardMaterial
              color={maps ? "#ffffff" : STONE_DARK}
              map={maps?.color ?? null}
              bumpMap={maps?.bump ?? null}
              bumpScale={1.4}
              roughness={0.9}
              flatShading
            />
          </mesh>
        )),
      )}
    </group>
  );
}
