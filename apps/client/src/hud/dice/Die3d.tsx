// A Parchís-style die drawn as a CSS 3D cube (specs/game-hud "Dice display"; openspec
// dice-tray-3d, design decisions 1 and 2). The look follows jico's "3D Dice with CSS"
// (https://codepen.io/jico/pen/wvMpgog, MIT): cream rounded faces, a large red single pip,
// red four pips, dark others, and a soft floor shadow. Reimplemented here, not copied.
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils.ts";

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

/** Pip cells (0–8 in a 3x3 grid, row by row) per face. */
export const PIPS: Readonly<Record<DieValue, readonly number[]>> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Faces with red pips, as on Parchís and Asian dice. */
export const RED_FACES: ReadonlySet<DieValue> = new Set<DieValue>([1, 4]);

/**
 * Where each face sits on the cube, as a rotation applied before `translateZ(half edge)`.
 * Opposite faces sum to 7: 1 front, 6 back, 2 top, 5 bottom, 3 right, 4 left.
 */
export const FACE_PLACEMENT: Readonly<Record<DieValue, string>> = {
  1: "rotateY(0deg)",
  6: "rotateY(180deg)",
  2: "rotateX(90deg)",
  5: "rotateX(-90deg)",
  3: "rotateY(90deg)",
  4: "rotateY(-90deg)",
};

/** Cube rotation (degrees) that turns face v to the viewer (+Z). */
export const FACE_ROTATION: Readonly<Record<DieValue, { x: number; y: number }>> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};

/** Fixed tilt that shows the top and right faces for depth. */
export const TILT = "rotateX(-18deg) rotateY(24deg)";

/** The cube's rest transform for a rolled value: tilt, then bring the face forward. */
export function restTransform(v: DieValue): string {
  const r = FACE_ROTATION[v];
  return `${TILT} rotateX(${r.x}deg) rotateY(${r.y}deg)`;
}

const DIE_STYLE: CSSProperties = {
  width: "var(--die)",
  height: "var(--die)",
};

function Face({ value }: { value: DieValue }) {
  const pips = PIPS[value];
  const red = RED_FACES.has(value);
  return (
    <span
      data-face={value}
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 place-items-center rounded-[22%] border border-die-rim bg-die p-[14%] [backface-visibility:hidden]"
      style={{ transform: `${FACE_PLACEMENT[value]} translateZ(calc(var(--die) / 2))` }}
    >
      {Array.from({ length: 9 }, (_, i) =>
        pips.includes(i) ? (
          <span
            key={i}
            data-pip
            className={cn(
              "rounded-full shadow-[inset_0_1px_1px_rgb(0_0_0/35%)]",
              red ? "bg-pip-red" : "bg-pip",
              value === 1 ? "size-[190%]" : "size-[70%]",
            )}
          />
        ) : (
          <span key={i} />
        ),
      )}
    </span>
  );
}

const FACES: readonly DieValue[] = [1, 2, 3, 4, 5, 6];

export interface Die3dProps {
  value: DieValue;
  /** Play the throw (tumble and bounce); otherwise rest on the value. */
  throwing?: boolean;
  /** Start delay of the throw, in ms. */
  delay?: number;
  /** Faded resting pose before any roll this turn. */
  idle?: boolean;
}

/** Decorative: the dice tray carries the accessible text. Size comes from `--die`. */
export function Die3d({ value, throwing = false, delay = 0, idle = false }: Die3dProps) {
  const timing = throwing ? { animationDelay: `${delay}ms` } : undefined;
  return (
    <span
      aria-hidden="true"
      data-die={value}
      data-throwing={throwing || undefined}
      className={cn("relative inline-block [perspective:420px]", idle && "opacity-80 saturate-50")}
      style={DIE_STYLE}
    >
      {/* Floor shadow: a radial gradient, not filter:blur (keeps WebKit's 3D intact). */}
      <span
        data-die-shadow
        className={cn(
          "absolute -bottom-[18%] left-[8%] h-[24%] w-[84%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/45%),transparent)]",
          throwing && "animate-dice-shadow",
        )}
        style={timing}
      />
      <span
        data-die-hop
        className={cn("absolute inset-0", throwing && "animate-dice-bounce")}
        style={timing}
      >
        <span
          data-die-cube
          className={cn(
            "absolute inset-0 [transform-style:preserve-3d]",
            throwing && "animate-dice-tumble",
          )}
          style={{
            ...timing,
            transform: restTransform(value),
            ["--rest" as string]: restTransform(value),
          }}
        >
          {/* Inner cross planes so the faces' rounded corners never show through. */}
          {["rotateY(0deg)", "rotateY(90deg)", "rotateX(90deg)"].map((t) => (
            <span key={t} className="absolute inset-[4%] bg-die-rim" style={{ transform: t }} />
          ))}
          {FACES.map((f) => (
            <Face key={f} value={f} />
          ))}
        </span>
      </span>
    </span>
  );
}
