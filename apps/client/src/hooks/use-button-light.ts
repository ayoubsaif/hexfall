// Pointer position for the button hover light (specs/illustrated-hud-style "Button dark mask
// and hover light"; design decision 9). One delegated, passive, rAF-throttled `pointermove`
// listener on `document` sets --lx / --ly (percent) on the `.btn-light` element under the
// pointer; style.css draws the light there. Touch is ignored so a tap never moves the light.
import { useEffect } from "react";

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

function percent(offset: number, size: number): string {
  if (!(size > 0)) return "50%";
  const p = Math.min(100, Math.max(0, (offset / size) * 100));
  return `${Math.round(p * 10) / 10}%`;
}

/** Pointer position inside `rect` as CSS percentages, clamped to 0–100% (50% for an empty rect). */
export function lightPosition(
  rect: RectLike,
  clientX: number,
  clientY: number,
): { x: string; y: string } {
  return {
    x: percent(clientX - rect.left, rect.width),
    y: percent(clientY - rect.top, rect.height),
  };
}

/** Mount once (App): keeps --lx / --ly on the hovered `.btn-light` button in step with the pointer. */
export function useButtonLight(): void {
  useEffect(() => {
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const e = last;
      last = null;
      if (!e || !(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(".btn-light");
      if (!el) return;
      const { x, y } = lightPosition(el.getBoundingClientRect(), e.clientX, e.clientY);
      el.style.setProperty("--lx", x);
      el.style.setProperty("--ly", y);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
