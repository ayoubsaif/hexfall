import { create } from "zustand";
import { usePrefsStore, type GraphicsQuality } from "../store/prefs.ts";
import { isLowPower } from "./waterTextures.ts";

export type QualityTier = Exclude<GraphicsQuality, "auto">;
/** What each tier changes: pixel density cap and shadows (specs/graphics-quality). Low caps at
 * 1.5 rather than 1 so chip labels stay sharp on high-density screens. */
export const QUALITY = {
  low: { dpr: 1.5, shadows: false, shadowSize: 512 },
  medium: { dpr: 1.5, shadows: true, shadowSize: 1024 },
  high: { dpr: 2, shadows: true, shadowSize: 2048 },
} as const;

/** Tiers that get the richer scenery: 3D forests on forest hexes (specs/forest-trees). */
export const QUALITY_RICH: Record<QualityTier, boolean> = { low: false, medium: true, high: true };

/** One sea for every tier ("Uniform sea across quality levels"): High's sea. 7 wave octaves on
 * a fine mesh, full shading, detailed rocks, and the GPU water simulation (waves reflect off
 * the rocks and foam where they hit; raised beach) wherever float render targets work. */
export const SEA = {
  segments: 256,
  waves: 7,
  low: false,
  rockDetail: 3,
  physical: true as boolean,
} as const;

export const useAutoQuality = create<{ tier: QualityTier }>(() => ({
  tier: isLowPower() ? "low" : "high",
}));

export function useGraphicsQuality(): QualityTier {
  const choice = usePrefsStore((s) => s.graphicsQuality);
  const auto = useAutoQuality((s) => s.tier);
  return choice === "auto" ? auto : choice;
}

/** Downward only for this session: avoid distracting quality oscillation. Ignore tab resumes.
 * Two slow three-second windows after warm-up are required, not one shader compilation hitch. */
export class QualitySampler {
  private warmup = 5;
  private seconds = 0;
  private frames = 0;
  private slowWindows = 0;

  sample(delta: number, tier: QualityTier, visible = true): QualityTier {
    if (!visible || !Number.isFinite(delta) || delta <= 0 || delta > 2) {
      this.seconds = this.frames = this.slowWindows = 0;
      return tier;
    }
    if (this.warmup > 0) {
      this.warmup -= delta;
      return tier;
    }
    this.seconds += delta;
    this.frames++;
    if (this.seconds < 3) return tier;
    const fps = this.frames / this.seconds;
    this.slowWindows = fps < 42 ? this.slowWindows + 1 : 0;
    this.seconds = this.frames = 0;
    if (this.slowWindows < 2) return tier;
    this.slowWindows = 0;
    this.warmup = 5;
    return tier === "high" ? "medium" : "low";
  }
}
