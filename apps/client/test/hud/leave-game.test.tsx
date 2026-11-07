// Leaving a running game in the HUD (openspec change leave-running-game, spec leave-game
// "Open seat indicator"): the open-seat badge and the chat notices.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ChatPanel } from "../../src/hud/ChatPanel.tsx";
import { PlayerPanels } from "../../src/hud/PlayerPanels.tsx";
import { addChatLine } from "../../src/store/chat.ts";
import { useRoomStore } from "../../src/store/room.ts";
import { playState } from "../game/fixtures.ts";
import { mount, resetAll, seatRoom, showGame, type Mounted } from "./helpers.tsx";

let m: Mounted | undefined;
beforeEach(() => resetAll());
afterEach(() => {
  m?.unmount();
  m = undefined;
  resetAll();
});

/** Marks `seat` as an open bot seat named `name` in the room store. */
function openSeat(seat: number, name: string, open = true) {
  act(() =>
    useRoomStore.setState((s) => ({
      seats: s.seats.map((x) => {
        if (x.seat !== seat) return x;
        const { open: _was, ...rest } = x;
        return { ...rest, name, bot: open, ...(open ? { open: true } : {}) };
      }),
    })),
  );
}

describe("open seat badge", () => {
  it("Seat opens: its panel shows the badge; taken over: the badge goes", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<PlayerPanels />);
    const badges = () => [...m!.container.querySelectorAll('[data-testid="open-seat"]')];
    expect(badges()).toHaveLength(0);
    openSeat(1, "Robo");
    const panels = m.container.querySelectorAll('[data-testid="player-panel"]');
    expect(panels[1]?.querySelector('[data-testid="open-seat"]')?.textContent).toBe("open seat");
    expect(badges()).toHaveLength(1);
    openSeat(1, "Eve", false);
    expect(badges()).toHaveLength(0);
    expect(panels[1]?.textContent).toContain("Eve");
  });
});

describe("chat notices", () => {
  it("shows who left and who took over, by seat color, never as a player's bubble", () => {
    seatRoom(0);
    m = mount(<ChatPanel />);
    act(() => {
      addChatLine({ id: 0, seat: 1, name: "Ben", text: "", at: 1, system: "left" }, 0);
      addChatLine({ id: 1, seat: 1, name: "Eve", text: "", at: 2, system: "tookOver" }, 0);
    });
    const notices = [...m.container.querySelectorAll('[data-testid="chat-notice"]')];
    expect(notices.map((n) => n.textContent)).toEqual([
      "Ben left; a bot is playing Blue",
      "Eve took over Blue",
    ]);
    expect(m.container.querySelectorAll('[data-testid="chat-line"]')).toHaveLength(0);
  });
});
