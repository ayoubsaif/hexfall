// GameCard and useCountChange (openspec hud-tailwind-cards, tasks 2.3 and 2.4).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { GameCard, cardArtUrl } from "../../src/hud/cards/GameCard.tsx";
import { type CountChange, useCountChange } from "../../src/hud/cards/useCountChange.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const card = () => container.querySelector<HTMLElement>("[data-card]");

describe("GameCard", () => {
  it("exposes 'Brick, 3' as text and keeps the art decorative", () => {
    act(() => root.render(<GameCard resource="brick" count={3} />));
    expect(container.querySelector(".sr-only")?.textContent).toBe("Brick, 3");
    const art = container.querySelector<HTMLElement>("[data-card-art]");
    expect(art?.getAttribute("aria-hidden")).toBe("true");
    expect(art?.style.backgroundImage).toContain(cardArtUrl("brick"));
    // The count badge is visual only; the name already carries it.
    expect(container.querySelector('[data-slot="badge"]')?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("still shows frame and name without its image", () => {
    act(() => root.render(<GameCard resource="ore" />));
    const el = card();
    // The frame color is on the card itself, independent of the art image.
    expect(el?.getAttribute("style")).toContain("--frame: var(--color-res-ore)");
    expect(el?.textContent).toContain("Ore");
  });

  it("marks a zero card dimmed", () => {
    act(() => root.render(<GameCard resource="wool" count={0} dimmed />));
    expect(card()?.dataset.dimmed).toBe("true");
  });

  it("renders a disabled interactive card as a disabled button with a description", () => {
    const onClick = vi.fn();
    act(() =>
      root.render(
        <GameCard
          dev="knight"
          onClick={onClick}
          disabled
          description="Bought this turn: playable from your next turn."
        />,
      ),
    );
    const btn = container.querySelector("button");
    expect(btn?.disabled).toBe(true);
    const descId = btn?.getAttribute("aria-describedby");
    expect(descId && document.getElementById(descId)?.textContent).toContain("next turn");
    act(() => btn?.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it("plays an enabled card on one click", () => {
    const onClick = vi.fn();
    act(() => root.render(<GameCard dev="monopoly" onClick={onClick} />));
    act(() => container.querySelector("button")?.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

/** Relative luminance and contrast ratio (WCAG 2.x). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
/** `top` at `alpha` over `under`, as hex. */
function over(top: string, alpha: number, under: string): string {
  const ch = (h: string, i: number) => Number.parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) => Math.round(ch(top, i) * alpha + ch(under, i) * (1 - alpha)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

describe("card label contrast", () => {
  it("meets 4.5:1 for the name on its ribbon, even over white art", () => {
    // Tokens from style.css: --color-hud-fg on --color-hud-solid at 90% (bg-hud-solid/90).
    const ribbonOverWhite = over("#0f2230", 0.9, "#ffffff");
    expect(contrast("#e9efe6", ribbonOverWhite)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("useCountChange", () => {
  let seen: CountChange[] = [];
  function Probe({ count }: { count: number }) {
    seen.push(useCountChange(count));
    return null;
  }
  beforeEach(() => {
    seen = [];
  });

  it("re-keys with 'in' on a rise and 'out' on a fall", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
    act(() => root.render(<Probe count={1} />));
    const first = seen.at(-1)!;
    act(() => root.render(<Probe count={2} />));
    const up = seen.at(-1)!;
    expect(up.key).not.toBe(first.key);
    expect(up.animation).toBe("in");
    act(() => root.render(<Probe count={1} />));
    const down = seen.at(-1)!;
    expect(down.animation).toBe("out");
    expect(down.key).not.toBe(up.key);
  });

  it("returns no animation under reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("reduce"),
      media: q,
    }));
    act(() => root.render(<Probe count={0} />));
    act(() => root.render(<Probe count={3} />));
    expect(seen.at(-1)!.animation).toBeNull();
  });
});
