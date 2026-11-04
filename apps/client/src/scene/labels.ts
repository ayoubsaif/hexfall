// Pure label models for number tokens and harbor markers (specs/board-view).
// The canvas drawing in NumberToken/HarborMarker renders exactly these values.
import type { HarborType } from "@hexfall/engine";
import type { HarborIcon } from "./harborIcons.ts";

/** Red emphasis for 6 and 8. */
export const TOKEN_RED = "#c0392b";
/** Dark ink for every other value and for harbor labels. */
export const INK = "#2b2118";

export interface TokenLabel {
  readonly text: string;
  /** Number of dice combinations: 6 − |7 − n|. */
  readonly pips: number;
  readonly color: string;
}

export function tokenLabel(value: number): TokenLabel {
  return {
    text: String(value),
    pips: 6 - Math.abs(7 - value),
    color: value === 6 || value === 8 ? TOKEN_RED : INK,
  };
}

export interface HarborLabel {
  readonly rate: "3:1" | "2:1";
  /** Icon of the traded resource, or an anchor for generic harbors. No words, so no i18n. */
  readonly icon: HarborIcon;
}

const HARBOR_ICON: Readonly<Record<HarborType, HarborIcon>> = {
  generic: "anchor",
  grain: "wheat",
  lumber: "trees",
  brick: "brickWall",
  ore: "mountain",
  wool: "sheep",
};

export function harborLabel(type: HarborType): HarborLabel {
  return { rate: type === "generic" ? "3:1" : "2:1", icon: HARBOR_ICON[type] };
}
