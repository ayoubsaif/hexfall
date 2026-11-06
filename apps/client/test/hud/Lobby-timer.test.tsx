import { AVATAR_IDS, type AvatarId } from "@hexfall/protocol";
// Turn-timer picker in the lobby (task 4.3; game-hud "Turn countdown", "Host picks a timer").
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Lobby, TURN_TIMER_KEY, loadTurnTimer } from "../../src/hud/Lobby.tsx";
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

beforeEach(() => {
  resetAll();
  localStorage.clear();
  calls = recordSession();
  act(() =>
    useRoomStore.setState({
      room: "K7QX2M",
      seat: 0,
      host: 0,
      status: "lobby",
      seats: ["Ana", "Ben", "Cy"].map((name, i) => ({
        seat: i,
        name,
        connected: true,
        bot: false,
        avatar: AVATAR_IDS[i] as AvatarId,
      })),
    }),
  );
});
afterEach(() => {
  m?.unmount();
  resetAll();
  localStorage.clear();
  vi.restoreAllMocks();
});

const radio = (v: string) =>
  m.container.querySelector<HTMLInputElement>(`input[name="hud-turn-timer"][value="${v}"]`)!;

describe("Lobby turn timer", () => {
  it("offers Off, Standard and Relaxed with Standard preselected", () => {
    m = mount(<Lobby inviteLink="l" />);
    expect(radio("off").checked).toBe(false);
    expect(radio("standard").checked).toBe(true);
    expect(radio("relaxed").checked).toBe(false);
    expect(m.container.textContent).toContain("Relaxed (60 s · 120 s)");
  });

  it("host picks Relaxed: the start sends it and it is remembered", () => {
    m = mount(<Lobby inviteLink="l" />);
    click(radio("relaxed"));
    click(byText(m.container, "button", "Start game"));
    expect(calls).toEqual([{ fn: "startGame", args: ["variable", undefined, "relaxed"] }]);
    expect(localStorage.getItem(TURN_TIMER_KEY)).toBe("relaxed");
  });

  it("preselects the remembered choice", () => {
    localStorage.setItem(TURN_TIMER_KEY, "off");
    m = mount(<Lobby inviteLink="l" />);
    expect(radio("off").checked).toBe(true);
    click(byText(m.container, "button", "Start game"));
    expect(calls[0]?.args[2]).toBe("off");
  });

  it("ignores junk and blocked storage", () => {
    localStorage.setItem(TURN_TIMER_KEY, "turbo");
    expect(loadTurnTimer()).toBe("standard");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadTurnTimer()).toBe("standard");
    m = mount(<Lobby inviteLink="l" />);
    click(radio("relaxed"));
    expect(radio("relaxed").checked).toBe(true);
  });

  it("non-hosts see no picker", () => {
    act(() => useRoomStore.setState({ seat: 1 }));
    m = mount(<Lobby inviteLink="l" />);
    expect(m.container.querySelector('input[name="hud-turn-timer"]')).toBeNull();
  });
});
