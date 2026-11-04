// Gain/spend motion for a card count (specs/hud-presentation "Minimal motion";
// design decision 7). Re-keys the card on every change so its CSS animation replays:
// "in" (slide) when the count rises, "out" (fade dip) when it falls. Under reduced
// motion no animation is returned at all.
import { useState } from "react";

export type CardAnimation = "in" | "out" | null;

export interface CountChange {
  /** Use as the card's React key so the animation restarts on every change. */
  key: number;
  animation: CardAnimation;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useCountChange(count: number): CountChange {
  const [prev, setPrev] = useState(count);
  const [change, setChange] = useState<CountChange>({ key: 0, animation: null });
  if (count !== prev) {
    // Adjusting state during render (React's documented pattern for derived changes).
    const next: CountChange = {
      key: change.key + 1,
      animation: prefersReducedMotion() ? null : count > prev ? "in" : "out",
    };
    setPrev(count);
    setChange(next);
    return next;
  }
  return change;
}

/** Tailwind animation class for a change (empty when none). */
export function animationClass(animation: CardAnimation): string {
  return animation === "in" ? "animate-card-in" : animation === "out" ? "animate-card-out" : "";
}
