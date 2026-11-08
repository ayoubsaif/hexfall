// Main (submit) buttons play the burn sound on press; other variants stay quiet.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const played = vi.hoisted(() => [] as string[]);
vi.mock("../../src/audio/sounds.ts", () => ({
  playSound: (name: string) => played.push(name),
}));

const { Button } = await import("../../src/components/ui/button.tsx");
const { SAMPLE_URLS } = await import("../../src/audio/samples.ts");

function press(node: React.ReactNode): void {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  act(() => root.render(node));
  act(() => el.querySelector("button")!.click());
  act(() => root.unmount());
  el.remove();
}

afterEach(() => {
  played.length = 0;
});

describe("burn sound on submit buttons", () => {
  it("a main button burns, then runs its own click", () => {
    const onClick = vi.fn(() => played.push("click"));
    press(<Button onClick={onClick}>Create room</Button>);
    expect(played).toEqual(["burn", "click"]);
  });

  it("a submit button in a form burns", () => {
    press(
      <form onSubmit={(e) => e.preventDefault()}>
        <Button type="submit">Send</Button>
      </form>,
    );
    expect(played).toEqual(["burn"]);
  });

  it("secondary, ghost and link buttons stay quiet; sound={false} opts out", () => {
    press(<Button variant="secondary">Cancel</Button>);
    press(<Button variant="ghost">Close</Button>);
    press(<Button variant="link">Remove</Button>);
    press(<Button sound={false}>Quiet</Button>);
    expect(played).toEqual([]);
  });

  it("a disabled main button makes no sound", () => {
    press(<Button disabled>Start</Button>);
    expect(played).toEqual([]);
  });

  it("the burn sample is a file the game ships", () => {
    expect(SAMPLE_URLS.burn).toBe("/sounds/burn.mp3");
  });
});
