import type { CSSProperties } from "react";
import { useReducedMotion } from "../store/motion.ts";

// Standard 19-hex island; shared edges are inked once (72 strokes total).
// Tiny deterministic bends suggest pen strokes without expensive SVG filters.
const strokes: string[] = [];
const seen = new Set<string>();
const radius = 66;
for (let row = -2; row <= 2; row++) {
  for (let q = Math.max(-2, -row - 2); q <= Math.min(2, -row + 2); q++) {
    const cx = Math.sqrt(3) * radius * (q + row / 2);
    const cy = radius * 1.5 * row;
    const corners = Array.from({ length: 6 }, (_, i): [number, number] => {
      const angle = ((60 * i - 30) * Math.PI) / 180;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
    const segments: string[] = [];
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = corners[i]!;
      const [bx, by] = corners[(i + 1) % 6]!;
      const key = [`${Math.round(ax)},${Math.round(ay)}`, `${Math.round(bx)},${Math.round(by)}`].sort().join("/");
      if (seen.has(key)) continue;
      seen.add(key);
      const bend = seen.size % 2 === 0 ? 0.6 : -0.6;
      segments.push(`M${ax},${ay} Q${(ax + bx) / 2 + bend},${(ay + by) / 2 - bend} ${bx},${by}`);
    }
    strokes.push(segments.join(" "));
  }
}

/** Decorative entry background: CSS strokes only, no canvas or animation loop. */
export function MapSketch() {
  const reduced = useReducedMotion();
  return (
    <svg
      className="map-sketch"
      data-still={reduced || undefined}
      viewBox="-320 -260 640 520"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {strokes.map((d, i) => (
        <path key={i} d={d} pathLength={1} style={{ "--draw-delay": `${i * 0.12}s` } as CSSProperties} />
      ))}
    </svg>
  );
}
