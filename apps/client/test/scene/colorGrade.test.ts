// Warm colour grade (specs/ambient-look "Warm color grade"): the colours players read the game by
// stay distinguishable after grading.
import { describe, expect, it } from "vite-plus/test";
import { SEAT_COLORS } from "../../src/game/colors.ts";
import { type Rgb, gradeColor, vignetteAmount } from "../../src/scene/colorGrade.ts";
import { INK, TOKEN_RED } from "../../src/scene/labels.ts";
import { TERRAIN_COLORS } from "../../src/theme/fallbacks/flat/tiles.tsx";
import { TOKEN_COLOR } from "../../src/theme/fallbacks/flat/token.tsx";

const rgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Every pair keeps at least 80 % of its original distance and stays clearly apart. */
function expectApart(colors: Record<string, string>) {
  const entries = Object.entries(colors);
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const [na, ha] = entries[i]!,
        [nb, hb] = entries[j]!;
      const before = dist(rgb(ha), rgb(hb));
      const after = dist(gradeColor(rgb(ha)), gradeColor(rgb(hb)));
      expect(after, `${na} vs ${nb}`).toBeGreaterThanOrEqual(Math.min(before * 0.8, 0.12));
    }
}

describe("colour grade", () => {
  it("keeps the six terrains apart", () => expectApart(TERRAIN_COLORS));

  it("keeps the seat colours apart from each other and from the terrains", () => {
    const seats = Object.fromEntries(SEAT_COLORS.map((s) => [s.name, s.hex]));
    expectApart(seats);
    for (const s of SEAT_COLORS) expectApart({ [s.name]: s.hex, ...TERRAIN_COLORS });
  });

  it("keeps the red 6 and 8 apart from the other numbers and the chip", () =>
    expectApart({ red: TOKEN_RED, ink: INK, chip: TOKEN_COLOR }));

  it("warms the image", () => {
    const [r, , b] = gradeColor([0.5, 0.5, 0.5]);
    expect(r).toBeGreaterThan(b);
  });

  it("darkens the corners, not the centre", () => {
    expect(vignetteAmount(0.5, 0.5, 16 / 9)).toBe(0);
    expect(vignetteAmount(0, 0, 16 / 9)).toBeGreaterThan(0.2);
    expect(vignetteAmount(0.5, 0.55, 16 / 9)).toBe(0);
  });
});
