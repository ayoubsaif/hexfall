// Bot level control in the lobby (specs/bots "Lobby bot controls", "Bot difficulty levels").
import { AVATAR_IDS, type AvatarId, type BotLevel } from "@hexfall/protocol";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { i18n } from "../../src/i18n/index.ts";
import { Lobby } from "../../src/hud/Lobby.tsx";
import { useConnectionStore } from "../../src/store/connection.ts";
import { useRoomStore } from "../../src/store/room.ts";
import { StartScreen } from "../../src/hud/StartScreen.tsx";
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

const human = (s: number, name: string) => ({
  seat: s,
  name,
  connected: true,
  bot: false,
  avatar: AVATAR_IDS[s] as AvatarId,
});
const bot = (s: number, name: string, level?: BotLevel) => ({
  ...human(s, name),
  bot: true,
  ...(level ? { level } : {}),
});

function lobbyOf(seats: ReturnType<typeof human>[], me = 0) {
  act(() => useRoomStore.setState({ room: "K7QX2M", seat: me, host: 0, status: "lobby", seats }));
}

/** The radio buttons of a choice group, and which one is picked. */
const radios = (group: Element) => [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
const picked = (group: Element) =>
  radios(group).find((r) => r.getAttribute("aria-checked") === "true")?.textContent;
const pick = (group: Element, label: string) =>
  click(radios(group).find((r) => r.textContent === label));

const controls = () => [...m.container.querySelectorAll<HTMLElement>('[data-testid="bot-level"]')];

beforeEach(() => {
  resetAll();
  calls = recordSession();
  act(() => useConnectionStore.setState({ status: "open" }));
});
afterEach(() => {
  m?.unmount();
  resetAll();
});

describe("bot level in the lobby", () => {
  it("the host gets a level control per bot seat, Normal when none is sent", () => {
    lobbyOf([human(0, "Ana"), bot(1, "Atlas"), bot(2, "Bramble", "hard")]);
    m = mount(<Lobby inviteLink="l" />);
    const [a, b] = controls();
    expect(controls()).toHaveLength(2);
    expect(a!.getAttribute("role")).toBe("radiogroup");
    expect(a!.tagName).not.toBe("SELECT");
    expect(picked(a!)).toBe("Normal");
    expect(picked(b!)).toBe("Hard");
    expect(a!.getAttribute("aria-label")).toBe("Level of Atlas");
    expect(radios(a!).map((o) => o.textContent)).toEqual(["Easy", "Normal", "Hard"]);
  });

  it("changing the level sends setBotLevel for that seat", () => {
    lobbyOf([human(0, "Ana"), bot(1, "Atlas")]);
    m = mount(<Lobby inviteLink="l" />);
    pick(controls()[0]!, "Hard");
    expect(calls).toEqual([{ fn: "setBotLevel", args: [1, "hard"] }]);
  });

  it("arrow keys move the level like a radio group", () => {
    lobbyOf([human(0, "Ana"), bot(1, "Atlas")]);
    m = mount(<Lobby inviteLink="l" />);
    const group = controls()[0]!;
    expect(radios(group).map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    act(() => {
      group.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(calls).toEqual([{ fn: "setBotLevel", args: [1, "hard"] }]);
  });

  it("is disabled while offline", () => {
    act(() => useConnectionStore.setState({ status: "closed" }));
    lobbyOf([human(0, "Ana"), bot(1, "Atlas")]);
    m = mount(<Lobby inviteLink="l" />);
    expect(radios(controls()[0]!).every((r) => r.disabled)).toBe(true);
  });

  it("a guest sees the level as text, with no control", () => {
    lobbyOf([human(0, "Ana"), human(1, "Ben"), bot(2, "Atlas", "hard")], 1);
    m = mount(<Lobby inviteLink="l" />);
    const [c] = controls();
    expect(c!.tagName).toBe("SPAN");
    expect(c!.textContent).toBe("Hard");
    expect(m.container.querySelector('[data-testid="bot-level"][role="radiogroup"]')).toBeNull();
  });

  it("has Spanish labels", async () => {
    await act(() => i18n.changeLanguage("es"));
    try {
      lobbyOf([human(0, "Ana"), human(1, "Ben"), bot(2, "Atlas", "easy")], 1);
      m = mount(<Lobby inviteLink="l" />);
      expect(controls()[0]!.textContent).toBe("Fácil");
    } finally {
      await act(() => i18n.changeLanguage("en"));
    }
  });
});

describe("bot level in the practice form", () => {
  function typeName(name: string) {
    const input = m.container.querySelector("input")!;
    act(() => {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
      desc.set!.call(input, name);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  const group = (id: string) => m.container.querySelector(`[data-testid="${id}"]`)!;

  it("offers Easy, Normal and Hard with Normal picked, and plays at the chosen level", () => {
    m = mount(<StartScreen mode="solo" />);
    expect(m.container.querySelector("select")).toBeNull();
    expect(radios(group("solo-level")).map((r) => r.textContent)).toEqual([
      "Easy",
      "Normal",
      "Hard",
    ]);
    expect(picked(group("solo-level"))).toBe("Normal");
    expect(picked(group("solo-opponents"))).toBe("2 bots");
    typeName("Ana");
    pick(group("solo-opponents"), "3 bots");
    pick(group("solo-level"), "Hard");
    click(byText(m.container, "button", "Play solo vs bots"));
    expect(calls.filter((c) => c.fn === "playSolo")).toEqual([
      { fn: "playSolo", args: ["Ana", 3, "villager-beard", "hard"] },
    ]);
  });
});
