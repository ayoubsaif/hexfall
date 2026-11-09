// specs/illustrated-hud-style "Button dark mask and hover light": the light follows the pointer.
import { describe, expect, it } from "vite-plus/test";
import { lightPosition } from "../../src/hooks/use-button-light.ts";

const rect = { left: 100, top: 50, width: 200, height: 40 };

describe("lightPosition", () => {
  it("maps the pointer to percentages of the button", () => {
    expect(lightPosition(rect, 200, 70)).toEqual({ x: "50%", y: "50%" });
    expect(lightPosition(rect, 100, 50)).toEqual({ x: "0%", y: "0%" });
    expect(lightPosition(rect, 300, 90)).toEqual({ x: "100%", y: "100%" });
    expect(lightPosition(rect, 150, 60)).toEqual({ x: "25%", y: "25%" });
  });

  it("clamps a pointer outside the button to 0–100%", () => {
    expect(lightPosition(rect, 20, 10)).toEqual({ x: "0%", y: "0%" });
    expect(lightPosition(rect, 900, 500)).toEqual({ x: "100%", y: "100%" });
  });

  it("rounds to one decimal", () => {
    expect(lightPosition({ left: 0, top: 0, width: 3, height: 3 }, 1, 2)).toEqual({
      x: "33.3%",
      y: "66.7%",
    });
  });

  it("falls back to the centre for an empty rect", () => {
    expect(lightPosition({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({
      x: "50%",
      y: "50%",
    });
  });
});
