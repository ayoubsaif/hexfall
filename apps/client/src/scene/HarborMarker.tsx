// Harbor marker: themed badge image outside its slot path, two link strips to the slot's
// intersections, and a small client-drawn trade rate at the badge's bottom edge. No icon,
// so the badge image stays clear (specs/board-view "Harbor markers").
import type { HarborType } from "@hexfall/engine";
import type { CanvasTexture } from "three";
import { Asset, useLandRelief } from "../theme/index.ts";
import { Y_LABEL, Y_LINK, makeLabelTexture } from "./canvasLabel.ts";
import { INK, harborLabel } from "./labels.ts";
import { LabelQuad } from "./LabelQuad.tsx";
import type { HarborItem, Link } from "./layout.ts";

const SANS = "'Segoe UI', Helvetica, Arial, sans-serif";
const LINK_WIDTH = 0.05;
const LINK_COLOR = "#e8dcc0";

/** Light halo under the ink so the rate reads on dark badge art and on the sea. */
const HALO = "#f4efe1";

/** Rate text size and center, as fractions of the canvas: small, along the bottom edge. */
export const RATE_SIZE = 0.24;
export const RATE_CENTER_Y = 0.84;

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
        ctx.lineWidth = s * 0.035;
        ctx.strokeStyle = HALO;
        ctx.strokeText(rate, s / 2, s * RATE_CENTER_Y);
        ctx.fillStyle = INK;
        ctx.fillText(rate, s / 2, s * RATE_CENTER_Y);
      }),
    );
  }
  return cache.get(type) ?? null;
}

function LinkStrip({ link, y }: { link: Link; y: number }) {
  return (
    <group position={[link.mid[0], y, link.mid[1]]} rotation={[0, link.yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[link.length, LINK_WIDTH]} />
        <meshStandardMaterial
          color={LINK_COLOR}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  );
}

export function HarborMarker({ item }: { item: HarborItem }) {
  const texture = harborTexture(item.type);
  // On a raised (isometric) island, harbors sit on the lowered sea.
  const { seaLevel } = useLandRelief();
  return (
    <>
      <LinkStrip link={item.links[0]} y={Y_LINK + seaLevel} />
      <LinkStrip link={item.links[1]} y={Y_LINK + seaLevel} />
      <group position={[item.position[0], 0, item.position[1]]}>
        <Asset assetKey={item.assetKey} />
        {texture && <LabelQuad texture={texture} size={0.4} y={Y_LABEL + seaLevel} />}
      </group>
    </>
  );
}
