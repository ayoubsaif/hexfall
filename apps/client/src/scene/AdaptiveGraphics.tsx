import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { usePrefsStore } from "../store/prefs.ts";
import { QualitySampler, useAutoQuality } from "./graphicsQuality.ts";

export function AdaptiveGraphics() {
  const choice = usePrefsStore((s) => s.graphicsQuality);
  const mode = usePrefsStore((s) => s.graphicsMode);
  const sampler = useMemo(() => new QualitySampler(), [choice, mode]);
  useFrame((_, delta) => {
    if (choice !== "auto") return;
    const tier = useAutoQuality.getState().tier;
    const next = sampler.sample(delta, tier, document.visibilityState === "visible");
    if (next !== tier) useAutoQuality.setState({ tier: next });
  });
  return null;
}
