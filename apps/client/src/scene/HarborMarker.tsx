// Harbor marker: one edge-aligned wooden pier with a chip resting directly on its deck, like the
// number tokens showing the resource icon and the trade rate (specs/board-view "Harbor markers").
import type { HarborType } from "@hexfall/engine";
import { useTexture } from "@react-three/drei";
import { type CanvasTexture, type Group, SRGBColorSpace } from "three";
import { CHIP, useLandRelief } from "../theme/index.ts";
import { makeLabelTexture } from "./canvasLabel.ts";
import { INK, harborLabel } from "./labels.ts";
import { LabelQuad } from "./LabelQuad.tsx";
import { HarborDock, HARBOR_DECK_TOP } from "./HarborDock.tsx";
import type { HarborItem } from "./layout.ts";

import { ChipDisc } from "./ChipDisc.tsx";

const SANS = "'Cormorant Garamond Variable', 'Cormorant Garamond', Georgia, serif";

/** The marker's colors: the resource card frame colors (style.css `--color-res-*`). */
export const HARBOR_COLORS: Readonly<Record<HarborType, string>> = {
  generic: "#d9c9a3",
  brick: "#a8472a",
  grain: "#c9962a",
  lumber: "#3d6e36",
  ore: "#5f6b78",
  wool: "#7fa046",
};
/** The plain 3:1 chip is a small, icon-free disc showing only the rate. */
const GENERIC_SCALE = 0.7;

/** Light halo under the ink so the rate reads on dark badge art and on the sea. */
const HALO = "#f7edd5";

/** Rate text size and center, as fractions of the canvas: in the lower part of the chip. */
export const RATE_SIZE = 0.38;
export const RATE_CENTER_Y = 0.78;

// The label has no words, so one texture per harbor type serves every language.
const cache = new Map<HarborType, CanvasTexture | null>();

function harborTexture(type: HarborType): CanvasTexture | null {
  if (!cache.has(type)) {
    const { rate } = harborLabel(type);
    const plain = type === "generic";
    const size = plain ? 0.57 : RATE_SIZE;
    const cy = plain ? 0.5 : RATE_CENTER_Y;
    cache.set(
      type,
      makeLabelTexture((ctx, s) => {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${Math.round(s * size)}px ${SANS}`;
        const width = ctx.measureText(rate).width;
        if (width > s * 0.86)
          ctx.font = `bold ${Math.floor((s * size * s * 0.86) / width)}px ${SANS}`;
        ctx.lineJoin = "round";
        ctx.lineWidth = s * 0.06;
        ctx.strokeStyle = HALO;
        ctx.strokeText(rate, s / 2, s * cy);
        ctx.fillStyle = INK;
        ctx.fillText(rate, s / 2, s * cy);
      }),
    );
  }
  return cache.get(type) ?? null;
}

/**
 * The harbor chip: the same chip as a number token, resting on the pier, turned to
 * face the camera like the number chips. It carries the resource icon above the trade rate
 * (3:1 or 2:1) and a thin ring in the resource color so the harbor reads from afar.
 */
function HarborChip({
  item,
  texture,
  y,
  chipRef,
}: {
  item: HarborItem;
  texture: CanvasTexture | null;
  y: number;
  chipRef: (g: Group | null) => void;
}) {
  // Special harbors retain their resource icon on the shared paper disc.
  const special = item.type !== "generic";
  const icon = useTexture(special ? `/ui/resources/${item.type}.webp` : "/ui/resources/wool.webp");
  icon.colorSpace = SRGBColorSpace;
  return (
    <group position={[0, y, 0]}>
      <group ref={chipRef} name="chip" scale={special ? 1 : GENERIC_SCALE}>
        <ChipDisc />
        {special && (
          <group position={[0, 0, -0.08]}>
            <LabelQuad texture={icon} size={0.34} y={CHIP.label + 0.001} />
          </group>
        )}
        {texture && <LabelQuad texture={texture} size={0.5} y={CHIP.label} />}
      </group>
    </group>
  );
}

export function HarborMarker({
  item,
  chipRef,
}: {
  item: HarborItem;
  chipRef: (g: Group | null) => void;
}) {
  const texture = harborTexture(item.type);
  // On a raised island the sea sits lower, and the harbor sits on it.
  const { seaLevel } = useLandRelief();
  const [px, pz] = item.position;
  // Use the slot edge midpoint, not the island center: outer hex edges have six exact normals.
  // Extend the sea end enough to support the complete 0.6-wide chip.
  const mx = (item.ends[0][0] + item.ends[1][0]) / 2;
  const mz = (item.ends[0][1] + item.ends[1][1]) / 2;
  const dx = mx - px;
  const dz = mz - pz;
  const extension = 0.15 / Math.hypot(dx, dz);
  const ox = -dx * extension;
  const oz = -dz * extension;
  const pierX = dx - ox;
  const pierZ = dz - oz;
  return (
    <group position={[px + ox, 0, pz + oz]}>
      <HarborDock dx={pierX} dz={pierZ} seaLevel={seaLevel} />
      <group position={[pierX / 2, 0, pierZ / 2]}>
        <HarborChip
          item={item}
          texture={texture}
          y={seaLevel + HARBOR_DECK_TOP}
          chipRef={chipRef}
        />
      </group>
    </group>
  );
}
