import { create } from "zustand";
import { usePrefsStore, type GraphicsQuality } from "../store/prefs.ts";
import { isLowPower } from "./waterTextures.ts";

export type QualityTier = Exclude<GraphicsQuality, "auto">;
export const QUALITY = {
  low: { dpr: 1, segments: 64, waves: 3, shadows: false, shadowSize: 512 },
  medium: { dpr: 1.5, segments: 160, waves: 5, shadows: true, shadowSize: 1024 },
  high: { dpr: 2, segments: 256, waves: 7, shadows: true, shadowSize: 2048 },
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
    if (!visible || !Number.isFinite(delta) || delta <= 0 || delta > 0.25) {
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
