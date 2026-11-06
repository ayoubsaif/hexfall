// Harbor marker: one short wooden pier at the slot and, floating above it, a chip like the
// number tokens showing the resource icon and the trade rate (specs/board-view "Harbor markers").
import type { HarborType } from "@hexfall/engine";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useRef } from "react";
import { type CanvasTexture, type Group, SRGBColorSpace } from "three";
import { Asset, CHIP, useLandRelief } from "../theme/index.ts";
import { makeLabelTexture } from "./canvasLabel.ts";
import { INK, harborLabel } from "./labels.ts";
import { LabelQuad } from "./LabelQuad.tsx";
import { HarborDock } from "./HarborDock.tsx";
import type { HarborItem } from "./layout.ts";
import { useReducedMotion } from "./motion.ts";

const SANS = "'Cormorant Garamond Variable', 'Cormorant Garamond', Georgia, serif";

/** The floating marker's colors: the resource card frame colors (style.css `--color-res-*`). */
export const HARBOR_COLORS: Readonly<Record<HarborType, string>> = {
  generic: "#d9c9a3",
  brick: "#a8472a",
  grain: "#c9962a",
  lumber: "#3d6e36",
  ore: "#5f6b78",
  wool: "#7fa046",
};
/** Length of the single short pier, and how high the chip floats above the sea. */
const PIER_LENGTH = 0.42;
const CHIP_FLOAT = 0.55;

/** Light halo under the ink so the rate reads on dark badge art and on the sea. */
const HALO = "#f4efe1";

/** Rate text size and center, as fractions of the canvas: in the lower part of the chip. */
export const RATE_SIZE = 0.3;
export const RATE_CENTER_Y = 0.78;

// The label has no words, so one texture per harbor type serves every language.
const cache = new Map<HarborType, CanvasTexture | null>();

function harborTexture(type: HarborType): CanvasTexture | null {
  if (!cache.has(type)) {
    const { rate } = harborLabel(type);
    cache.set(
      type,
      makeLabelTexture((ctx, s) => {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${Math.round(s * RATE_SIZE)}px ${SANS}`;
        ctx.lineJoin = "round";
        ctx.lineWidth = s * 0.06;
        ctx.strokeStyle = HALO;
        ctx.strokeText(rate, s / 2, s * RATE_CENTER_Y);
        ctx.fillStyle = INK;
        ctx.fillText(rate, s / 2, s * RATE_CENTER_Y);
      }),
    );
  }
  return cache.get(type) ?? null;
}

/**
 * The floating harbor chip: the same chip as a number token, hovering over the pier, turned to
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
  const ref = useRef<Group>(null);
  const reduced = useReducedMotion();
  const icon = useTexture(`/textures/harbor/${item.type}.webp`);
  icon.colorSpace = SRGBColorSpace;
  useFrame(({ clock }) => {
    const g = ref.current;
    if (g) g.position.y = y + (reduced ? 0 : Math.sin(clock.elapsedTime * 1.2 + item.slot) * 0.015);
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      <group ref={chipRef} name="chip">
        <mesh position={[0, -0.004, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.02, 40]} />
          <meshStandardMaterial color={HARBOR_COLORS[item.type]} roughness={0.6} />
        </mesh>
        <Asset assetKey="token" />
        <group position={[0, 0, -0.08]}>
          <LabelQuad texture={icon} size={0.3} y={CHIP.label} />
        </group>
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
  // One short pier running from the slot toward the island center, plus the floating chip.
  const d = Math.hypot(px, pz) || 1;
  const dx = (-px / d) * PIER_LENGTH;
  const dz = (-pz / d) * PIER_LENGTH;
  return (
    <group position={[px, 0, pz]}>
      <HarborDock dx={dx} dz={dz} seaLevel={seaLevel} />
      <group position={[dx / 2, 0, dz / 2]}>
        <HarborChip item={item} texture={texture} y={seaLevel + CHIP_FLOAT} chipRef={chipRef} />
      </group>
    </group>
  );
}
