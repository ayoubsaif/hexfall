// Parchment tokens (openspec settlecoast-parchment-ui, "Parchment design tokens"):
// every text/surface pair that the HUD uses meets WCAG AA. Tokens are read from style.css.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const css = readFileSync(resolve(process.cwd(), "src/style.css"), "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not a hex colour in style.css`);
  return m[1]!;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const text = ["ink", "ink-muted", "ok", "wait", "bad", "leather", "forest"];
const surfaces = ["paper", "paper-deep"];

describe("parchment token contrast", () => {
  for (const t of text)
    for (const s of surfaces)
      it(`${t} on ${s} >= 4.5:1`, () => {
        expect(ratio(token(t), token(s))).toBeGreaterThanOrEqual(4.5);
      });
  it("cream on leather >= 4.5:1", () => {
    expect(ratio(token("cream"), token("leather"))).toBeGreaterThanOrEqual(4.5);
  });
  it("cream on forest >= 4.5:1", () => {
    expect(ratio(token("cream"), token("forest"))).toBeGreaterThanOrEqual(4.5);
  });
  it("focus ring (forest) on paper >= 3:1", () => {
    expect(ratio(token("forest"), token("paper"))).toBeGreaterThanOrEqual(3);
  });
});
