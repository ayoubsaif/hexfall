// Harbor marker: themed badge outside its slot path, two link strips to the slot's
// intersections, and a client-drawn label: a type icon above the trade rate, no words.
import type { HarborType } from "@hexfall/engine";
import type { CanvasTexture } from "three";
import { Asset, useBoardStyle, useLandRelief } from "../theme/index.ts";
import { Y_LABEL, Y_LINK, makeLabelTexture } from "./canvasLabel.ts";
import { HARBOR_ICON_PATHS, type HarborIcon, ICON_VIEWBOX } from "./harborIcons.ts";
import { INK, harborLabel } from "./labels.ts";
import { LabelQuad } from "./LabelQuad.tsx";
import type { HarborItem, Link } from "./layout.ts";

const SANS = "'Segoe UI', Helvetica, Arial, sans-serif";
const LINK_WIDTH = 0.05;
const LINK_COLOR = "#e8dcc0";

/** Light halo under the ink so icon and rate read on dark badges and on the sea. */
const HALO = "#f4efe1";

/** Icon box side and center, and rate text size and center, as fractions of the canvas. */
const ICON_BOX = 0.56;
const ICON_CENTER_Y = 0.35;
const RATE_SIZE = 0.3;
const RATE_CENTER_Y = 0.8;

/** Strokes the icon's paths into a square box of side `box` centered at (cx, cy). */
function strokeIcon(
  ctx: CanvasRenderingContext2D,
  icon: HarborIcon,
  cx: number,
  cy: number,
  box: number,
): void {
  const scale = box / ICON_VIEWBOX;
  const paths = HARBOR_ICON_PATHS[icon].map((d) => new Path2D(d));
  ctx.save();
  ctx.translate(cx - box / 2, cy - box / 2);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Halo pass first, then ink on top (stroke widths in viewBox units).
  for (const [color, width] of [
    [HALO, 4.5],
    [INK, 2],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const p of paths) ctx.stroke(p);
  }
  ctx.restore();
}

// The label has no words, so one texture per harbor type serves every language.
const cache = new Map<HarborType, CanvasTexture | null>();

function harborTexture(type: HarborType): CanvasTexture | null {
  if (!cache.has(type)) {
    const { rate, icon } = harborLabel(type);
    cache.set(
      type,
      makeLabelTexture((ctx, s) => {
        strokeIcon(ctx, icon, s / 2, s * ICON_CENTER_Y, s * ICON_BOX);
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

/** Unit vector from the slot path's midpoint toward the marker (out to sea). */
function outward(item: HarborItem): [number, number] {
  const [a, b] = item.ends;
  const dx = item.position[0] - (a[0] + b[0]) / 2;
  const dz = item.position[1] - (a[1] + b[1]) / 2;
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
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
  const { style } = useBoardStyle();
  // On a raised (isometric) island, harbors sit on the lowered sea.
  const { seaLevel } = useLandRelief();
  const [ox, oz] = outward(item);
  return (
    <>
      <LinkStrip link={item.links[0]} y={Y_LINK + seaLevel} />
      <LinkStrip link={item.links[1]} y={Y_LINK + seaLevel} />
      {style === "flat" ? (
        <group position={[item.position[0], 0, item.position[1]]}>
          <Asset assetKey={item.assetKey} />
          {texture && <LabelQuad texture={texture} size={0.4} y={Y_LABEL + seaLevel} />}
        </group>
      ) : (
        <>
          {/* The 3D dock points along local −Z; turn it to face the island. */}
          <group
            position={[item.position[0], 0, item.position[1]]}
            rotation={[0, Math.atan2(ox, oz), 0]}
          >
            <Asset assetKey={item.assetKey} />
          </group>
          {texture && (
            <group position={[item.position[0] + ox * 0.42, 0, item.position[1] + oz * 0.42]}>
              <LabelQuad texture={texture} size={0.36} />
            </group>
          )}
        </>
      )}
    </>
  );
}
