// The HUD root element, so Radix portals (dialogs, sheets, tooltips) render inside `.hud`
// and keep its pointer-events contract and stacking above the canvas (design decision 3).
import { createContext, useContext } from "react";

export const HudRootContext = createContext<HTMLElement | null>(null);

/** The `.hud` element, or null outside the HUD (portals then fall back to document.body). */
export function useHudRoot(): HTMLElement | null {
  return useContext(HudRootContext);
}
