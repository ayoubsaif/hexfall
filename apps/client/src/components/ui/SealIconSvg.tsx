// Vector wax seal (alternative to the image in SealIcon.tsx): irregular red wax edge, recessed
// centre with a gold rim, two laurel branches and a gold serif X (thick and thin strokes with
// serifs). Generated from a few numbers so it stays symmetric; no image request.
const C = 50;

/** Irregular wax outline: lobes of different sizes, like a pressed blob of wax. */
const WAX = (() => {
  const n = 90;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 41 + 2.8 * Math.sin(a * 5 + 0.9) + 1.8 * Math.sin(a * 9 - 0.3) + 1.2 * Math.sin(a * 2 + 2);
    pts.push(`${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
})();

/** One laurel branch (side = -1 left, 1 right): a curved stem with paired leaves. */
function branch(side: -1 | 1) {
  const R = 27;
  const leaves: { x: number; y: number; rot: number; k: string }[] = [];
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const deg = 8 + i * 15; // from straight down, rising up the side
    const a = ((90 + side * deg) * Math.PI) / 180;
    const x = C + R * Math.cos(a);
    const y = C + R * Math.sin(a);
    const tangent = (a * 180) / Math.PI + 90; // along the stem
    leaves.push({ x, y, rot: tangent + side * 55, k: `o${i}` }); // outer leaf
    leaves.push({ x, y, rot: tangent - side * 55, k: `i${i}` }); // inner leaf
  }
  const start = ((90 + side * 4) * Math.PI) / 180;
  const end = ((90 + side * 112) * Math.PI) / 180;
  const stem = `M${(C + R * Math.cos(start)).toFixed(2)} ${(C + R * Math.sin(start)).toFixed(2)}A${R} ${R} 0 0 ${side === 1 ? 1 : 0} ${(C + R * Math.cos(end)).toFixed(2)} ${(C + R * Math.sin(end)).toFixed(2)}`;
  return { leaves, stem };
}

const BRANCHES = [branch(-1), branch(1)];

export function SealIconSvg({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={className}>
      <defs>
        <radialGradient id="sealv-wax" cx="36%" cy="28%" r="85%">
          <stop offset="0" stopColor="#f4604f" />
          <stop offset="0.45" stopColor="#c8291f" />
          <stop offset="1" stopColor="#74100c" />
        </radialGradient>
        <radialGradient id="sealv-dish" cx="60%" cy="70%" r="80%">
          <stop offset="0" stopColor="#d63a2c" />
          <stop offset="1" stopColor="#a11e17" />
        </radialGradient>
        <linearGradient id="sealv-gold" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#fff3b8" />
          <stop offset="0.45" stopColor="#e5bc52" />
          <stop offset="1" stopColor="#9f6f14" />
        </linearGradient>
      </defs>
      <path d={WAX} fill="url(#sealv-wax)" stroke="#560a07" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 40C22 25 35 14 50 12" fill="none" stroke="#ffb0a2" strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
      <path d="M82 66C78 78 68 86 56 88" fill="none" stroke="#3d0603" strokeWidth="2.2" strokeLinecap="round" opacity="0.35" />
      {/* recessed centre with a thin gold rim */}
      <circle cx={C} cy={C} r="35" fill="url(#sealv-dish)" stroke="#5f0d09" strokeWidth="1.2" />
      <circle cx={C} cy={C} r="33" fill="none" stroke="#e9b24d" strokeWidth="0.9" opacity="0.75" />
      {BRANCHES.map((b, bi) => (
        <g key={bi}>
          <path d={b.stem} fill="none" stroke="url(#sealv-gold)" strokeWidth="1.1" strokeLinecap="round" />
          {b.leaves.map((l) => (
            <path
              key={l.k}
              d="M0 0C2.4 -2 3 -6 0 -9C-3 -6 -2.4 -2 0 0Z"
              transform={`translate(${l.x.toFixed(2)} ${l.y.toFixed(2)}) rotate(${l.rot.toFixed(1)}) scale(0.8)`}
              fill="url(#sealv-gold)"
              stroke="#6b4a10"
              strokeWidth="0.45"
            />
          ))}
        </g>
      ))}
      {/* serif X: dark under-stroke, thick stroke (top-left to bottom-right), thin stroke, serifs */}
      <g strokeLinecap="butt">
        <g stroke="#4f3306" opacity="0.85">
          <path d="M33 33L67 67" strokeWidth="11" />
          <path d="M67 33L33 67" strokeWidth="6.5" />
        </g>
        <path d="M33 33L67 67" stroke="url(#sealv-gold)" strokeWidth="9" />
        <path d="M67 33L33 67" stroke="url(#sealv-gold)" strokeWidth="4.6" />
        <g fill="url(#sealv-gold)" stroke="#4f3306" strokeWidth="0.7">
          <rect x="26" y="29.5" width="14" height="4.2" />
          <rect x="60" y="29.5" width="14" height="4.2" />
          <rect x="26" y="66.3" width="14" height="4.2" />
          <rect x="60" y="66.3" width="14" height="4.2" />
        </g>
        <path d="M35 33.5L50 48.5" stroke="#fffbe0" strokeWidth="1.2" opacity="0.7" />
      </g>
    </svg>
  );
}
