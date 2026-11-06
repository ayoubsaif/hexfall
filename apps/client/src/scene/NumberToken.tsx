// Number token: the themed `token` chip plus a client-drawn value and pips label on its top
// face. The board view turns the whole chip to face the camera (scene/chipYaw.ts).
import type { CanvasTexture } from "three";
import { CHIP, TOKEN_RADIUS } from "../theme/index.ts";
import { makeLabelTexture } from "./canvasLabel.ts";
import { tokenLabel } from "./labels.ts";
import { LabelQuad } from "./LabelQuad.tsx";

import { ChipDisc } from "./ChipDisc.tsx";

const SERIF = "'Cormorant Garamond Variable', 'Cormorant Garamond', Georgia, serif";

/** One generous size for every roll; probability changes weight only. */
export const NUMBER_SIZE = 0.64;
export function numberWeight(pips: number): number {
  return [300, 400, 500, 700, 900][Math.max(0, Math.min(4, pips - 1))]!;
}

// One texture per value (2–12 without 7), drawn on first use.
const cache = new Map<number, CanvasTexture | null>();

function tokenTexture(value: number): CanvasTexture | null {
  if (!cache.has(value)) {
    const { text, pips, color } = tokenLabel(value);
    cache.set(
      value,
      makeLabelTexture((ctx, s) => {
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${numberWeight(pips)} ${Math.round(s * NUMBER_SIZE)}px ${SERIF}`;
        // Fit all labels, including two-digit values, inside the chip's printable width.
        const width = ctx.measureText(text).width;
        if (width > s * 0.82)
          ctx.font = `${numberWeight(pips)} ${Math.round((s * NUMBER_SIZE * s * 0.82) / width)}px ${SERIF}`;
        if (numberWeight(pips) > 700) {
          ctx.strokeStyle = color;
          ctx.lineWidth = s * 0.012;
          ctx.strokeText(text, s / 2, s * 0.42);
        }
        ctx.fillText(text, s / 2, s * 0.42);
        const r = s * 0.035;
        const gap = s * 0.1;
        const x0 = s / 2 - ((pips - 1) * gap) / 2;
        for (let i = 0; i < pips; i++) {
          ctx.beginPath();
          ctx.arc(x0 + i * gap, s * 0.8, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
    );
  }
  return cache.get(value) ?? null;
}

export function NumberToken({ value }: { value: number }) {
  const texture = tokenTexture(value);
  return (
    <>
      <ChipDisc />
      {texture && <LabelQuad texture={texture} size={TOKEN_RADIUS * (5 / 3)} y={CHIP.label} />}
    </>
  );
}
