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
  readonly key: "orange" | "blue" | "white" | "violet" | "green" | "brown";
}

export const SEAT_COLORS: readonly SeatColor[] = Object.freeze([
  { hex: "#e0662f", ink: "#1a0d05", name: "Orange", key: "orange" },
  { hex: "#2f6bd8", ink: "#ffffff", name: "Blue", key: "blue" },
  { hex: "#f1ead9", ink: "#1d1a14", name: "White", key: "white" },
  { hex: "#4b2f7f", ink: "#ffffff", name: "Violet", key: "violet" },
  // Seats 4 and 5 only appear in 5–6 player games. Teal-green sits apart from the forest and
  // pasture greens; dark brown sits apart from the hills and from orange by lightness.
  { hex: "#12a37f", ink: "#04140f", name: "Green", key: "green" },
  { hex: "#5a3a1e", ink: "#ffffff", name: "Brown", key: "brown" },
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
