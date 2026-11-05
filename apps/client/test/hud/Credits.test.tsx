import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CreditsList } from "../../src/hud/Credits.tsx";
import type { ResolvedTheme } from "../../src/theme/resolve.ts";

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
});

const base: ResolvedTheme = {
  id: "diorama",
  baseUrl: "/themes/diorama/",
  entries: {},
  license: "CC0-1.0",
  source: "Original work for Hexfall.",
};

describe("CreditsList (settings About section)", () => {
  it("lists credits with title, author, license and a safe external link", () => {
    const theme: ResolvedTheme = {
      ...base,
      credits: [
        {
          keys: ["piece.road", "piece.settlement", "piece.city"],
          title: "Game pieces",
          author: "A. Maker",
          url: "https://example.com/pieces",
          license: "CC-BY-4.0",
        },
      ],
    };
    act(() => root.render(<CreditsList theme={theme} />));
    const item = document.querySelector('[data-testid="credits-list"] li');
    expect(item?.textContent).toContain("Game pieces");
    expect(item?.textContent).toContain("A. Maker");
    expect(item?.textContent).toContain("CC-BY-4.0");
    const link = item?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/pieces");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows the theme license and source when there are no credits", () => {
    act(() => root.render(<CreditsList theme={base} />));
    expect(document.querySelector('[data-testid="credits-list"]')).toBeNull();
    const text = container.textContent ?? "";
    expect(text).toContain("CC0-1.0");
    expect(text).toContain("Original work for Hexfall.");
  });
});
