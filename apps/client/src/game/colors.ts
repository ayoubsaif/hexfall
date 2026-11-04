// Fixed seat colors (specs/board-interaction, "Seat colors"). The same for every viewer.
// Picked for contrast with the terrain art and sea, and to stay apart under
// deuteranopia/protanopia (orange vs. blue vs. light vs. dark), not by hue alone.
import type { T } from "../i18n/index.ts";

export interface SeatColor {
  /** Piece and accent color. */
  readonly hex: string;
  /** Readable text color on top of `hex`. */
  readonly ink: string;
  /** English name (tests, debugging). Show `seatColorName()` to players. */
  readonly name: string;
  /** Catalog key under `game.color`. */
  readonly key: "orange" | "blue" | "white" | "violet";
}

export const SEAT_COLORS: readonly SeatColor[] = Object.freeze([
  { hex: "#e0662f", ink: "#1a0d05", name: "Orange", key: "orange" },
  { hex: "#2f6bd8", ink: "#ffffff", name: "Blue", key: "blue" },
  { hex: "#f1ead9", ink: "#1d1a14", name: "White", key: "white" },
  { hex: "#4b2f7f", ink: "#ffffff", name: "Violet", key: "violet" },
]);

export function seatColor(seat: number): SeatColor {
  const c = SEAT_COLORS[seat];
  if (!c) throw new Error(`no color for seat ${seat}`);
  return c;
}

/** The seat color's name in the active language, for screen readers and the log. */
export function seatColorName(seat: number, t: T): string {
  return t(`game.color.${seatColor(seat).key}`);
}
