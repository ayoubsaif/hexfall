// Shared helper for client-drawn label textures (no font files fetched at runtime).
import { CanvasTexture, SRGBColorSpace } from "three";

export const LABEL_PX = 256;

/** Layer heights above the board plane (design.md decision 7). */
export const Y_LINK = 0.002;
export const Y_LABEL = 0.006;

/**
 * Draws a square label with `draw` and wraps it in a texture. Returns null when no 2D
 * canvas context is available (e.g. tests), so callers render no label instead of crashing.
 */
export function makeLabelTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_PX;
  canvas.height = LABEL_PX;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  draw(ctx, LABEL_PX);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  // Cached labels must be repainted once the self-hosted variable font arrives.
  void document.fonts?.ready.then(() => {
    ctx.clearRect(0, 0, LABEL_PX, LABEL_PX);
    draw(ctx, LABEL_PX);
    texture.needsUpdate = true;
  });
  return texture;
}
