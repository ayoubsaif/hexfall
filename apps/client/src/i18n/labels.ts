// Translated names for resources and development cards, shared by the HUD.
import type { DevCard, Resource } from "@hexfall/engine";
import type { T } from "./index.ts";

export function resourceLabel(t: T, r: Resource): string {
  return t(`common.resource.${r}`);
}

export function devCardLabel(t: T, card: DevCard): string {
  return t(`common.devCard.${card}`);
}
