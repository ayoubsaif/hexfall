import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hud } from "../../src/hud/Hud.tsx";
import { resetWelcome } from "../../src/hud/Welcome.tsx";
import { useRoomStore } from "../../src/store/room.ts";
import { click, mount, resetAll, type Mounted } from "./helpers.tsx";

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
  it("shows first with Play, examples and both ad slots; Play opens the start screen", () => {
    m = mount(<Hud />);
    expect(q("welcome")).not.toBeNull();
    expect(m.container.querySelectorAll('[data-testid="welcome-example"]')).toHaveLength(4);
    expect(q("ad-slot-left")).not.toBeNull();
    expect(q("ad-slot-right")).not.toBeNull();
    expect(q("welcome-play")?.textContent).toBe("Play Game");
    click(q("welcome-play")!);
    expect(q("welcome")).toBeNull();
    expect(m.container.querySelector("h1")?.textContent).toBe("Hexfall");
    expect(m.container.querySelector("input")).not.toBeNull();
    expect(q("ad-slot-left")).not.toBeNull();
  });

  it("is skipped for an invite link", () => {
    act(() => useRoomStore.setState({ prefillRoom: "ABC234" }));
    m = mount(<Hud />);
    expect(q("welcome")).toBeNull();
    expect(m.container.querySelector("input")).not.toBeNull();
  });
});
