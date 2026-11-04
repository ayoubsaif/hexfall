import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CreditsButton, CreditsDialog } from "../../src/hud/Credits.tsx";
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

/** The dialog's "Close" button (the dialog is portalled into document.body). */
function closeButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
    (b) => b.textContent === "Close",
  );
}

describe("CreditsDialog", () => {
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
    act(() => root.render(<CreditsDialog theme={theme} onClose={() => {}} />));
    // Radix portals the dialog to document.body when there is no HUD root.
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
    act(() => root.render(<CreditsDialog theme={base} onClose={() => {}} />));
    expect(document.querySelector('[data-testid="credits-list"]')).toBeNull();
    const text = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(text).toContain("CC0-1.0");
    expect(text).toContain("Original work for Hexfall.");
  });

  it("closes on Escape and on the Close button", () => {
    const onClose = vi.fn();
    act(() => root.render(<CreditsDialog theme={base} onClose={onClose} />));
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    act(() => closeButton()?.click());
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("CreditsButton", () => {
  it("opens and closes the credits dialog", () => {
    act(() => root.render(<CreditsButton />));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    act(() =>
      container.querySelector<HTMLButtonElement>('[data-testid="credits-toggle"]')?.click(),
    );
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => closeButton()?.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
