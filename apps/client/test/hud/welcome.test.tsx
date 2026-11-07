import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hud } from "../../src/hud/Hud.tsx";
import { resetWelcome } from "../../src/hud/Welcome.tsx";
import { useRoomStore } from "../../src/store/room.ts";
import {
  click,
  mount,
  resetAll,
  recordSession,
  type as enterText,
  type Mounted,
} from "./helpers.tsx";

let m: Mounted;
beforeEach(() => {
  resetAll();
  resetWelcome();
});
afterEach(() => {
  m?.unmount();
  resetAll();
  resetWelcome();
});
const q = (id: string) => m.container.querySelector(`[data-testid="${id}"]`);

describe("Welcome screen", () => {
  it("shows game modes and an optional guide; choosing friends opens the host form", () => {
    m = mount(<Hud />);
    expect(q("welcome")).not.toBeNull();
    expect(m.container.querySelectorAll('[data-testid="welcome-example"]')).toHaveLength(4);
    // Ad slots are off for now.
    expect(q("ad-slot-left")).toBeNull();
    expect(q("ad-slot-right")).toBeNull();
    expect(q("welcome-host")?.textContent).toContain("Play with friends");
    // No drawn island: the only icons are the buttons' own.
    expect(q("welcome")?.querySelector("svg:not([data-icon])")).toBeNull();
    click(q("welcome-host")!);
    expect(q("welcome")).toBeNull();
    expect(m.container.querySelector("h1")?.textContent).toBe("Hexfall");
    expect(m.container.querySelector("input")).not.toBeNull();
    expect(q("ad-slot-left")).toBeNull();
  });

  it.each([
    ["host", "Create room", "createRoom"],
    ["solo", "Play solo vs bots", "playSolo"],
    ["join", "Join room", "joinRoom"],
  ] as const)("%s opens a focused form and sends the right request", (mode, label, fn) => {
    const calls = recordSession();
    m = mount(<Hud />);
    click(q(`welcome-${mode}`)!);
    enterText(m.container.querySelector("input"), "Ana");
    if (mode === "join") enterText(m.container.querySelectorAll("input")[1], "ABC234");
    const button = [...m.container.querySelectorAll("button")].find(
      (b) => b.textContent === label,
    )!;
    expect(button.disabled).toBe(false);
    click(button);
    expect(calls.some((c) => c.fn === fn)).toBe(true);
    if (mode !== "join") expect(m.container.querySelectorAll("input")).toHaveLength(1);
  });

  it("allows returning to the mode menu", () => {
    m = mount(<Hud />);
    click(q("welcome-solo")!);
    const back = [...m.container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Choose another game mode"),
    )!;
    click(back);
    expect(q("welcome-host")).not.toBeNull();
  });

  it("is skipped for an invite link", () => {
    act(() => useRoomStore.setState({ prefillRoom: "ABC234" }));
    m = mount(<Hud />);
    expect(q("welcome")).toBeNull();
    expect(m.container.querySelector("input")).not.toBeNull();
  });
});

describe("Install prompt", () => {
  it("offers a one-tap install only once the browser allows it, and prompts on click", async () => {
    const { setDeferredInstall } = await import("../../src/pwa/install.ts");
    m = mount(<Hud />);
    expect(q("install-app")).toBeNull();
    let prompted = 0;
    act(() =>
      setDeferredInstall({
        prompt: async () => void prompted++,
        userChoice: Promise.resolve({ outcome: "accepted" }),
      } as never),
    );
    expect(q("install-app")?.textContent).toContain("Install the app");
    await act(async () => click(q("install-app")!));
    expect(prompted).toBe(1);
    expect(q("install-app")).toBeNull();
  });
});
