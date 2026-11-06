// Borderless 2.5D dice illustration for the dice control (specs/board-dice "Dice tray readout"):
// two classic red isometric cubes with gold pips on a transparent background and a soft ground
// shadow. Three faces are visible per cube (top, left, right); the pips are drawn flat in each
// face's own coordinates and mapped onto it with an affine matrix, so they sit in true
// perspective. Pure SVG, no image asset and no second WebGL context.
const PIP_POS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.27, 0.27],
    [0.5, 0.5],
    [0.73, 0.73],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  6: [
    [0.27, 0.25],
    [0.73, 0.25],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.75],
    [0.73, 0.75],
  ],
};

/** Left and right faces for a given top value: never the top's opposite (sum 7) or the top. */
function sides(top: number): [number, number] {
  if (top === 1 || top === 6) return [2, 3];
  if (top === 2 || top === 5) return [1, 3];
  return [1, 2];
}

// Cube geometry in a 100 x 100 unit box (width 52, height 60): edge vectors of the top face.
const EX = [26, 15] as const; // top face "right" edge, running down-right
const EY = [-26, 15] as const; // top face "left" edge, running down-left
const H = 30; // vertical edge length

function Pips({ value, matrix, id }: { value: number; matrix: string; id: string }) {
  return (
    <g transform={`matrix(${matrix})`}>
      {(PIP_POS[value] ?? PIP_POS[1]!).map(([x, y], i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={y}
            r={0.1}
            fill="#5a3200"
            opacity={0.55}
            transform="translate(0.012 0.02)"
          />
          <circle cx={x} cy={y} r={0.095} fill={`url(#${id}-gold)`} />
        </g>
      ))}
    </g>
  );
}

function Cube({ x, y, value, id }: { x: number; y: number; value: number; id: string }) {
  const [left, right] = sides(value);
  const O = [0, 0] as const;
  const F = [EX[0] + EY[0], EX[1] + EY[1]] as const; // front vertex of the top face
  const R = [EX[0], EX[1]] as const;
  const L = [EY[0], EY[1]] as const;
  const pt = (p: readonly [number, number], dy = 0) => `${p[0]},${p[1] + dy}`;
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="0" cy={F[1] + H + 3} rx="34" ry="9" fill="#000" opacity="0.28" />
      {/* faces */}
      <polygon
        points={`${pt(O)} ${pt(R)} ${pt(F)} ${pt(L)}`}
        fill={`url(#${id}-top)`}
        stroke="#6e0f0a"
        strokeWidth="2.2"
      />
      <polygon
        points={`${pt(L)} ${pt(F)} ${pt(F, H)} ${pt(L, H)}`}
        fill={`url(#${id}-left)`}
        stroke="#6e0f0a"
        strokeWidth="2.2"
      />
      <polygon
        points={`${pt(F)} ${pt(R)} ${pt(R, H)} ${pt(F, H)}`}
        fill={`url(#${id}-right)`}
        stroke="#6e0f0a"
        strokeWidth="2.2"
      />
      {/* rounded-edge highlights */}
      <path
        d={`M${pt(L)} L${pt(F)} L${pt(R)}`}
        fill="none"
        stroke="#ff9a8a"
        strokeWidth="1.1"
        opacity="0.7"
      />
      <path
        d={`M${pt(F)} L${pt(F, H)}`}
        fill="none"
        stroke="#e5584a"
        strokeWidth="1"
        opacity="0.6"
      />
      <path
        d={`M${pt(O)} L${pt(R)}`}
        fill="none"
        stroke="#ffb8aa"
        strokeWidth="0.9"
        opacity="0.5"
      />
      {/* pips: top face, left face, right face */}
      <Pips id={id} value={value} matrix={`${EX[0]} ${EX[1]} ${EY[0]} ${EY[1]} 0 0`} />
      <Pips id={id} value={left} matrix={`${EX[0]} ${EX[1]} 0 ${H} ${EY[0]} ${EY[1]}`} />
      <Pips id={id} value={right} matrix={`${EX[0]} ${-EX[1]} 0 ${H} ${F[0]} ${F[1]}`} />
    </g>
  );
}

export function DiceArt({
  dice,
  rolling,
  className,
}: {
  dice: readonly [number, number] | null;
  rolling?: boolean;
  className?: string;
}) {
  const [a, b] = dice ?? [5, 2];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 -2 116 98"
      data-rolling={rolling || undefined}
      className={className}
      style={{ filter: "drop-shadow(0 3px 3px rgb(0 0 0 / 40%))", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="dice-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0503f" />
          <stop offset="1" stopColor="#c92a1f" />
        </linearGradient>
        <linearGradient id="dice-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c0261b" />
          <stop offset="1" stopColor="#8f1710" />
        </linearGradient>
        <linearGradient id="dice-right" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9d1a12" />
          <stop offset="1" stopColor="#650d08" />
        </linearGradient>
        <radialGradient id="dice-gold" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff1b0" />
          <stop offset="0.55" stopColor="#e8bc4a" />
          <stop offset="1" stopColor="#a8741c" />
        </radialGradient>
      </defs>
      <Cube x={30} y={8} value={a} id="dice" />
      <Cube x={84} y={24} value={b} id="dice" />
    </svg>
  );
}
