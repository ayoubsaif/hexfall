// The harbor sail label (specs/board-view "Harbor markers"): the boat's sail shows the trade
// rate, and special harbors also show their resource icon on a sail tinted in the resource
// colour. One texture and one material per harbor type, shared by every boat of that type.
import type { HarborType } from "@hexfall/engine";
import { type CanvasTexture, DoubleSide, MeshStandardMaterial } from "three";
import { makeLabelTexture } from "./canvasLabel.ts";
import { INK, harborLabel } from "./labels.ts";

/** Plain sailcloth, as on the boat model's own canvas material. */
export const SAIL_CLOTH = "#d1b885";

/** Sail colour per harbor type: plain cloth for 3:1, a light resource tint for 2:1. */
export const HARBOR_SAIL_BASE: Readonly<Record<HarborType, string>> = {
  generic: SAIL_CLOTH,
  brick: "#eab8a2",
  grain: "#f3d98c",
  lumber: "#b9d4a6",
  ore: "#c6ced8",
  wool: "#d8e8b0",
};

const SERIF = "'Cormorant Garamond Variable', 'Cormorant Garamond', Georgia, serif";
/** Light halo under the ink so the rate reads on every tint. */
const HALO = "#f7edd5";
/** Sails are about 1.2× wider than tall; the square canvas is squashed back horizontally. */
const SAIL_ASPECT = 1.2;

export interface SailLayout {
  readonly background: string;
  /** Resource icon URL, or null for the plain 3:1 sail. */
  readonly icon: string | null;
  readonly rate: "3:1" | "2:1";
  /** Rate text size and centre, as fractions of the canvas. */
  readonly rateSize: number;
  readonly rateY: number;
}

/** What a sail shows, per harbor type. Pure, so it is unit-testable. */
export function sailLayout(type: HarborType): SailLayout {
  const special = type !== "generic";
  return {
    background: HARBOR_SAIL_BASE[type],
    icon: special ? `/ui/resources/${type}.webp` : null,
    rate: harborLabel(type).rate,
    rateSize: special ? 0.4 : 0.56,
    rateY: special ? 0.73 : 0.5,
  };
}

function drawSail(
  ctx: CanvasRenderingContext2D,
  s: number,
  layout: SailLayout,
  icon: HTMLImageElement | null,
): void {
  ctx.fillStyle = layout.background;
  ctx.fillRect(0, 0, s, s);
  // Cloth panels: faint vertical seams and a darker hem around the edge.
  ctx.strokeStyle = "rgb(60 40 20 / 14%)";
  ctx.lineWidth = s * 0.008;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo((s * i) / 5, 0);
    ctx.lineTo((s * i) / 5, s);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgb(60 40 20 / 30%)";
  ctx.lineWidth = s * 0.04;
  ctx.strokeRect(0, 0, s, s);

  ctx.save();
  ctx.translate(s / 2, 0);
  ctx.scale(1 / SAIL_ASPECT, 1);
  ctx.translate(-s / 2, 0);
  if (icon) {
    const size = s * 0.5;
    ctx.drawImage(icon, (s - size) / 2, s * 0.04, size, size);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(s * layout.rateSize)}px ${SERIF}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = s * 0.05;
  ctx.strokeStyle = HALO;
  ctx.strokeText(layout.rate, s / 2, s * layout.rateY);
  ctx.fillStyle = INK;
  ctx.fillText(layout.rate, s / 2, s * layout.rateY);
  ctx.restore();
}

const textures = new Map<HarborType, CanvasTexture | null>();

/** The sail texture for a harbor type; null without a 2D canvas (tests). */
export function sailTexture(type: HarborType): CanvasTexture | null {
  if (textures.has(type)) return textures.get(type) ?? null;
  const layout = sailLayout(type);
  let icon: HTMLImageElement | null = null;
  const texture = makeLabelTexture((ctx, s) => drawSail(ctx, s, layout, icon));
  textures.set(type, texture);
  if (texture && layout.icon && typeof Image !== "undefined") {
    // Draw the icon in once it decodes, so the label never waits on loading.
    const img = new Image();
    img.onload = () => {
      icon = img;
      const canvas = texture.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawSail(ctx, canvas.width, layout, icon);
      texture.needsUpdate = true;
    };
    img.src = layout.icon;
  }
  return texture;
}

const materials = new Map<HarborType, MeshStandardMaterial>();

/** The shared sail material for a harbor type (plain tint when no canvas is available). */
export function sailMaterial(type: HarborType): MeshStandardMaterial {
  let m = materials.get(type);
  if (!m) {
    const map = sailTexture(type);
    m = new MeshStandardMaterial({
      color: map ? "#ffffff" : HARBOR_SAIL_BASE[type],
      map,
      roughness: 0.85,
      side: DoubleSide,
    });
    m.name = `Harbor Sail ${type}`;
    materials.set(type, m);
  }
  return m;
}
