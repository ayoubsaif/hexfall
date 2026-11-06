// Player avatars (specs/player-avatars, specs/hud-notifications).
import { AVATAR_IDS, type AvatarId } from "@hexfall/protocol";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Avatar } from "../../src/hud/Avatar.tsx";
import { AvatarPicker } from "../../src/hud/AvatarPicker.tsx";
import { Toasts } from "../../src/hud/Feed.tsx";
import { Hud } from "../../src/hud/Hud.tsx";
import { Lobby } from "../../src/hud/Lobby.tsx";
import { PlayerPanels } from "../../src/hud/PlayerPanels.tsx";
import { playState } from "../game/fixtures.ts";
import { dismissToast, pushToast, useUiStore } from "../../src/store/ui.ts";
import { useRoomStore } from "../../src/store/room.ts";
import {
  click,
  mount,
  recordSession,
  resetAll,
  seatRoom,
  showGame,
  type Call,
  type Mounted,
} from "./helpers.tsx";

let m: Mounted;
let calls: Call[];

beforeEach(() => {
  resetAll();
  calls = recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
});

const seat = (s: number, name: string, avatar: AvatarId = AVATAR_IDS[s] as AvatarId) => ({
  seat: s,
  name,
  connected: true,
  bot: false,
  avatar,
});

describe("Avatar", () => {
  it("shows the image with empty alt text and the seat color ring", () => {
    m = mount(<Avatar id="farmer" seat={1} name="Ben" />);
    const img = m.container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("avatars/farmer.webp");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("falls back to the name's initial when the image fails", () => {
    m = mount(<Avatar id="farmer" seat={1} name="ben" />);
    act(() => {
      m.container.querySelector("img")?.dispatchEvent(new Event("error"));
    });
    expect(m.container.querySelector("img")).toBeNull();
    expect(m.container.textContent).toBe("B");
  });

  it("shows only the initial without an id", () => {
    m = mount(<Avatar seat={0} name="Ana" />);
    expect(m.container.textContent).toBe("A");
  });
});

describe("AvatarPicker", () => {
  it("offers every catalog avatar and disables taken ones with the owner's name", () => {
    const picked: AvatarId[] = [];
    m = mount(
      <AvatarPicker
        value="villager-beard"
        taken={new Map<AvatarId, string>([["farmer", "Ben"]])}
        onChange={(id) => picked.push(id)}
      />,
    );
    const radios = [...m.container.querySelectorAll<HTMLElement>("[role=radio]")];
    expect(radios).toHaveLength(AVATAR_IDS.length);
    const farmer = radios.find((r) => r.dataset.avatar === "farmer");
    expect(farmer?.getAttribute("aria-disabled")).toBe("true");
    expect(farmer?.getAttribute("title")).toContain("Ben");
    click(farmer);
    expect(picked).toEqual([]);
    click(radios.find((r) => r.dataset.avatar === "baker"));
    expect(picked).toEqual(["baker"]);
  });

  it("arrow keys skip taken avatars", () => {
    const picked: AvatarId[] = [];
    m = mount(
      <AvatarPicker
        value="villager-beard"
        taken={new Map<AvatarId, string>([["herbalist", "Ben"]])}
        onChange={(id) => picked.push(id)}
      />,
    );
    const first = m.container.querySelector<HTMLElement>("[data-avatar=villager-beard]");
    act(() => {
      first?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(picked).toEqual(["farmer"]);
  });
});

describe("Lobby avatars", () => {
  it("changing the avatar sends setAvatar and shows other seats' choices as taken", () => {
    act(() =>
      useRoomStore.setState({
        room: "K7QX2M",
        seat: 0,
        host: 0,
        status: "lobby",
        seats: [seat(0, "Ana"), seat(1, "Ben", "fisher")],
      }),
    );
    m = mount(<Lobby inviteLink="l" />);
    const fisher = m.container.querySelector<HTMLElement>("[role=radio][data-avatar=fisher]");
    expect(fisher?.getAttribute("aria-disabled")).toBe("true");
    click(m.container.querySelector("[role=radio][data-avatar=baker]"));
    expect(calls).toEqual([{ fn: "setAvatar", args: ["baker"] }]);
  });
});

describe("Toasts", () => {
  it("shows the avatar of the seat a toast is about", () => {
    act(() =>
      useRoomStore.setState({
        room: "K7QX2M",
        seat: 0,
        status: "playing",
        seats: [seat(0, "Ana"), seat(1, "Ben")],
      }),
    );
    m = mount(<Toasts />);
    act(() => void pushToast("Ben stole a card", "info", 0, 1));
    const toast = m.container.querySelector("[data-testid=toast]");
    expect(toast?.querySelector("[data-testid=avatar]")?.getAttribute("data-avatar")).toBe(
      AVATAR_IDS[1],
    );
  });

  it("shows no avatar on toasts without a seat", () => {
    m = mount(<Toasts />);
    act(() => void pushToast("Seven rolled", "info", 0));
    expect(m.container.querySelector("[data-testid=avatar]")).toBeNull();
  });

  it("keeps at most 3 toasts, dropping the oldest", () => {
    let ids: number[] = [];
    act(() => {
      ids = [1, 2, 3, 4].map((n) => pushToast(`t${n}`, "info", 0));
    });
    const texts = useUiStore.getState().toasts.map((t) => t.text);
    expect(texts).toEqual(["t2", "t3", "t4"]);
    act(() => ids.forEach(dismissToast));
  });
});

describe("Avatars in play", () => {
  it("each player panel shows that seat's avatar", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<PlayerPanels />);
    const shown = [...m.container.querySelectorAll("[data-testid=player-panel]")].map((p) =>
      p.querySelector("[data-testid=avatar]")?.getAttribute("data-avatar"),
    );
    expect(shown).toEqual(AVATAR_IDS.slice(0, 4));
  });
});

describe("Toast placement", () => {
  it("sits bottom-right above the action buttons, never centered, and lets clicks through", () => {
    m = mount(<Hud />);
    const anchor = m.container.querySelector<HTMLElement>("[data-testid=toast-anchor]");
    expect(anchor).not.toBeNull();
    const cls = anchor?.className ?? "";
    expect(cls).toContain("right-3");
    expect(cls).toContain("bottom-[calc(var(--hand-h,0px)_+_var(--fab-h,0px)_+_20px)]");
    expect(cls).toContain("pointer-events-none");
    expect(cls).not.toContain("left-1/2");
  });
});
