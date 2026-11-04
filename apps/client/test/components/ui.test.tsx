// shadcn primitives inside the HUD (openspec hud-tailwind-cards, task 1.4).
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog.tsx";
import { HudRootContext } from "@/components/ui/hud-root.ts";
import { Sheet, SheetContent } from "@/components/ui/sheet.tsx";

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

/** Same wiring as Hud.tsx: a `.hud` element provided as the portal root. */
function HudHarness({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return (
    <HudRootContext value={el}>
      <div className="hud" ref={setEl}>
        <button type="button">outside</button>
        {el && children}
      </div>
    </HudRootContext>
  );
}

describe("Dialog in the HUD", () => {
  it("portals into .hud, is interactive, focuses inside and closes on Escape", () => {
    function Demo() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent title="Discard cards">
            <Button>Confirm</Button>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      );
    }
    act(() =>
      root.render(
        <HudHarness>
          <Demo />
        </HudHarness>,
      ),
    );
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.closest(".hud")).not.toBeNull();
    expect(dialog?.hasAttribute("data-interactive")).toBe(true);
    expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog?.contains(document.activeElement)).toBe(true);

    act(() => {
      dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("names the sheet by its title", () => {
    act(() =>
      root.render(
        <HudHarness>
          <Sheet open>
            <SheetContent title="Event log">
              <p>log</p>
            </SheetContent>
          </Sheet>
        </HudHarness>,
      ),
    );
    const sheet = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(sheet?.closest(".hud")).not.toBeNull();
    const labelId = sheet?.getAttribute("aria-labelledby");
    expect(labelId && document.getElementById(labelId)?.textContent).toBe("Event log");
  });

  it("closes the sheet from its visible Close button", () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <HudHarness>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent title="Event log">
              <p>log</p>
            </SheetContent>
          </Sheet>
        </HudHarness>
      );
    }
    act(() => root.render(<Harness />));
    const close = document.querySelector<HTMLButtonElement>('[role="dialog"] [aria-label="Close"]');
    expect(close).not.toBeNull();
    act(() => close?.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
