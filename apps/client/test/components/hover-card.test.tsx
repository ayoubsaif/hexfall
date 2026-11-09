// specs/hover-cards: hover/focus open, press-and-hold on touch, short tap still acts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HoverCard } from "@/components/ui/hover-card.tsx";
import { HudRootContext } from "@/components/ui/hud-root.ts";
import { LONG_PRESS_MS, movedTooFar } from "../../src/hooks/use-long-press.ts";

let host: HTMLDivElement;
let hud: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  hud = document.createElement("div");
  hud.className = "hud";
  document.body.append(host, hud);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  hud.remove();
  vi.useRealTimers();
});

function renderCard(onClick: () => void) {
  act(() =>
    root.render(
      <HudRootContext value={hud}>
        <HoverCard content={<p>Distance Rule</p>}>
          <button type="button" onClick={onClick}>
            Build settlement
          </button>
        </HoverCard>
      </HudRootContext>,
    ),
  );
  return host.querySelector("button")!;
}

function pointer(el: Element, type: string, init: PointerEventInit) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...init }));
  });
}

const card = () => document.querySelector('[data-testid="hover-card"]');

describe("movedTooFar", () => {
  it("allows small jitter and cancels past 10 px", () => {
    expect(movedTooFar({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(false);
    expect(movedTooFar({ x: 0, y: 0 }, { x: 8, y: 8 })).toBe(true);
  });
});

describe("HoverCard", () => {
  it("opens after hovering with a mouse", () => {
    const button = renderCard(() => {});
    pointer(button, "pointerenter", { pointerType: "mouse" });
    pointer(button, "pointerover", { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(card()?.textContent).toContain("Distance Rule");
    expect(card()?.closest(".hud")).not.toBeNull();
  });

  it("opens on a touch hold and swallows the click that follows", () => {
    const onClick = vi.fn();
    const button = renderCard(onClick);
    pointer(button, "pointerdown", { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    });
    pointer(button, "pointerup", { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => button.click());
    expect(card()).not.toBeNull();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("a short tap still clicks and opens nothing", () => {
    const onClick = vi.fn();
    const button = renderCard(onClick);
    pointer(button, "pointerdown", { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    pointer(button, "pointerup", { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => button.click());
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(card()).toBeNull();
  });

  it("moving the finger cancels the hold", () => {
    const button = renderCard(() => {});
    pointer(button, "pointerdown", { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer(button, "pointermove", { pointerType: "touch", clientX: 40, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    });
    expect(card()).toBeNull();
  });

  it("pointercancel cancels the hold", () => {
    const button = renderCard(() => {});
    pointer(button, "pointerdown", { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer(button, "pointercancel", { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    });
    expect(card()).toBeNull();
  });

  it("keyboard focus opens it and Escape closes it", () => {
    const button = renderCard(() => {});
    act(() => button.focus());
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(card()).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(card()).toBeNull();
  });
});
