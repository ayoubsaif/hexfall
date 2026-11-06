// Number token: the themed `token` chip plus a client-drawn value and pips label on its top
// face. The board view turns the whole chip to face the camera (scene/chipYaw.ts).
import type { CanvasTexture } from "three";
import { Asset, CHIP } from "../theme/index.ts";
import { makeLabelTexture } from "./canvasLabel.ts";
import { tokenLabel } from "./labels.ts";
import { LabelQuad } from "./LabelQuad.tsx";

const SERIF = "'Cormorant Garamond Variable', 'Cormorant Garamond', Georgia, serif";

/**
 * Font size (fraction of the label) by probability: 1 pip (2, 12) is smallest, 5 pips (6, 8)
 * largest, so the likeliest numbers stand out. Always larger for more pips.
 */
export function numberSize(pips: number): number {
  return 0.3 + 0.07 * (pips - 1);
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
        ctx.font = `bold ${Math.round(s * numberSize(pips))}px ${SERIF}`;
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
      <Asset assetKey="token" />
      {texture && <LabelQuad texture={texture} size={0.5} y={CHIP.label} />}
    </>
  );
}
