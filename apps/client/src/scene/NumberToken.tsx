// Number token: the themed `token` disc plus a client-drawn value and pips label.
import type { CanvasTexture } from "three";
import { Asset, TOKEN_LABEL_Y, useBoardStyle } from "../theme/index.ts";
import { makeLabelTexture } from "./canvasLabel.ts";
import { tokenLabel } from "./labels.ts";
import { LabelQuad } from "./LabelQuad.tsx";

const SERIF = "Georgia, 'Times New Roman', Times, serif";

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
        ctx.font = `bold ${Math.round(s * 0.46)}px ${SERIF}`;
        ctx.fillText(text, s / 2, s * 0.44);
        const r = s * 0.035;
        const gap = s * 0.1;
        const x0 = s / 2 - ((pips - 1) * gap) / 2;
        for (let i = 0; i < pips; i++) {
          ctx.beginPath();
          ctx.arc(x0 + i * gap, s * 0.76, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
    );
  }
  return cache.get(value) ?? null;
}

export function NumberToken({ value }: { value: number }) {
  const texture = tokenTexture(value);
  const { style } = useBoardStyle();
  return (
    <>
      <Asset assetKey="token" />
      {texture && <LabelQuad texture={texture} size={0.5} y={TOKEN_LABEL_Y[style]} />}
    </>
  );
}
