// Bot level control in the lobby (specs/bots "Lobby bot controls", "Bot difficulty levels").
import { AVATAR_IDS, type AvatarId, type BotLevel } from "@hexfall/protocol";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { i18n } from "../../src/i18n/index.ts";
import { Lobby } from "../../src/hud/Lobby.tsx";
import { useConnectionStore } from "../../src/store/connection.ts";
import { useRoomStore } from "../../src/store/room.ts";
import { mount, recordSession, resetAll, type Call, type Mounted } from "./helpers.tsx";

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

/** Picks `value` in a select the way React notices it. */
function choose(el: HTMLSelectElement, value: string): void {
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  act(() => {
    desc?.set?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

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
    const [a, b] = controls() as HTMLSelectElement[];
    expect(controls()).toHaveLength(2);
    expect(a!.tagName).toBe("SELECT");
    expect(a!.value).toBe("normal");
    expect(b!.value).toBe("hard");
    expect(a!.getAttribute("aria-label")).toBe("Level of Atlas");
    expect([...a!.options].map((o) => o.textContent)).toEqual(["Easy", "Normal", "Hard"]);
  });

  it("changing the level sends setBotLevel for that seat", () => {
    lobbyOf([human(0, "Ana"), bot(1, "Atlas")]);
    m = mount(<Lobby inviteLink="l" />);
    choose(controls()[0] as HTMLSelectElement, "hard");
    expect(calls).toEqual([{ fn: "setBotLevel", args: [1, "hard"] }]);
  });

  it("is disabled while offline", () => {
    act(() => useConnectionStore.setState({ status: "closed" }));
    lobbyOf([human(0, "Ana"), bot(1, "Atlas")]);
    m = mount(<Lobby inviteLink="l" />);
    expect((controls()[0] as HTMLSelectElement).disabled).toBe(true);
  });

  it("a guest sees the level as text, with no control", () => {
    lobbyOf([human(0, "Ana"), human(1, "Ben"), bot(2, "Atlas", "hard")], 1);
    m = mount(<Lobby inviteLink="l" />);
    const [c] = controls();
    expect(c!.tagName).toBe("SPAN");
    expect(c!.textContent).toBe("Hard");
    expect(m.container.querySelector("select[aria-label^='Level']")).toBeNull();
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
