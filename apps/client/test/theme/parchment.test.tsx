// Parchment theme guards (openspec settlecoast-parchment-ui, task 6.2).
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";
import { Button } from "@/components/ui/button.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("selected tile", () => {
  it("exposes aria-pressed and a distinct selected style", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const root = createRoot(el);
    act(() =>
      root.render(
        <Button variant="secondary" aria-pressed={true}>
          Tile
        </Button>,
      ),
    );
    const b = el.querySelector("button")!;
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(b.className).toContain("aria-pressed:to-leather");
    act(() => root.unmount());
    el.remove();
  });
});

describe("fonts are self-hosted", () => {
  const sources = [read("../../index.html"), read("../../src/style.css")];
  it("references no third-party font host", () => {
    for (const s of sources) {
      expect(s).not.toMatch(
        /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit|cdnjs|jsdelivr|unpkg/,
      );
    }
  });
  it("loads fonts only from /fonts", () => {
    const urls = sources.flatMap((s) =>
      [...s.matchAll(/url\(["']?([^"')]+\.woff2?)/g)].map((m) => m[1]),
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/^\/fonts\//);
  });
});
