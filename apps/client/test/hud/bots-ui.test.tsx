import { AVATAR_IDS, type AvatarId } from "@hexfall/protocol";
// Bots in the UI (specs/bots "Lobby bot controls", "Play solo from the start screen").
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Lobby } from "../../src/hud/Lobby.tsx";
import { StartScreen } from "../../src/hud/StartScreen.tsx";
import { useConnectionStore } from "../../src/store/connection.ts";
import { useRoomStore } from "../../src/store/room.ts";
import {
  byText,
  click,
  mount,
  recordSession,
  resetAll,
  type Call,
  type Mounted,
} from "./helpers.tsx";

let m: Mounted;
let calls: Call[];

const seat = (s: number, name: string, bot = false) => ({
  seat: s,
  name,
  connected: true,
  bot,
  avatar: AVATAR_IDS[s] as AvatarId,
});

function lobbyOf(seats: ReturnType<typeof seat>[], me = 0) {
  act(() => useRoomStore.setState({ room: "K7QX2M", seat: me, host: 0, status: "lobby", seats }));
}

beforeEach(() => {
  resetAll();
  calls = recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
});

describe("Lobby bots", () => {
  it("the host can start alone, with a note that bots fill to 3", () => {
    lobbyOf([seat(0, "Ana")]);
    m = mount(<Lobby inviteLink="l" />);
    const start = byText(m.container, "button", "Start game")!;
    expect(start.disabled).toBe(false);
    expect(m.container.textContent).toContain("Bots will fill empty seats up to 3 players.");
    click(start);
    expect(calls[0]?.fn).toBe("startGame");
  });

  it("Add bot sends addBot until 6 seats, then it is gone", () => {
    lobbyOf([seat(0, "Ana")]);
    m = mount(<Lobby inviteLink="l" />);
    click(byText(m.container, "button", "Add bot"));
    expect(calls).toEqual([{ fn: "addBot", args: [] }]);
    act(() =>
      lobbyOf([seat(0, "Ana"), seat(1, "Ben"), seat(2, "Atlas", true), seat(3, "Bramble", true)]),
    );
    expect(byText(m.container, "button", "Add bot")).toBeTruthy();
    act(() =>
      lobbyOf([
        seat(0, "Ana"),
        seat(1, "Ben"),
        seat(2, "Atlas", true),
        seat(3, "Bramble", true),
        seat(4, "Cedar", true),
        seat(5, "Dune", true),
      ]),
    );
    expect(byText(m.container, "button", "Add bot")).toBeFalsy();
  });

  it("marks bots, never offline, and the host removes one", () => {
    lobbyOf([seat(0, "Ana"), seat(1, "Atlas", true)]);
    m = mount(<Lobby inviteLink="l" />);
    const row = m.container.querySelectorAll('[data-testid="lobby-seat"]')[1]!;
    expect(row.textContent).toContain("bot");
    expect(row.textContent).not.toContain("offline");
    click(byText(row as HTMLElement, "button", "Remove"));
    expect(calls).toEqual([{ fn: "removeBot", args: [1] }]);
  });

  it("a guest has no bot controls", () => {
    lobbyOf([seat(0, "Ana"), seat(1, "Ben"), seat(2, "Atlas", true)], 1);
    m = mount(<Lobby inviteLink="l" />);
    expect(byText(m.container, "button", "Add bot")).toBeFalsy();
    expect(byText(m.container, "button", "Remove")).toBeFalsy();
  });
});

describe("Play solo", () => {
  it("creates a solo game with the chosen number of bots", () => {
    act(() => useConnectionStore.setState({ status: "open" }));
    m = mount(<StartScreen />);
    const input = m.container.querySelector("input")!;
    act(() => {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
      desc.set!.call(input, "Ana");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const solo = byText(m.container, "button", "Play solo vs bots")!;
    expect(solo.disabled).toBe(false);
    click(solo);
    expect(calls.filter((c) => c.fn === "playSolo")).toEqual([
      { fn: "playSolo", args: ["Ana", 2, "villager-beard", "normal"] },
    ]);
  });
});
