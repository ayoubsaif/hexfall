// 5–6 player games and the victory target in the HUD (openspec add-5-6-player-extension,
// tasks 9.2–9.4): lobby target and large-board note, solo with up to 5 bots, six panels,
// the goal chip and the Special Building Phase controls.
import { createGame, type GameState, type Seat } from "@hexfall/engine";
import { AVATAR_IDS, type AvatarId } from "@hexfall/protocol";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Lobby, VICTORY_TARGET_KEY, loadVictoryTarget } from "../../src/hud/Lobby.tsx";
import { PlayerPanels } from "../../src/hud/PlayerPanels.tsx";
import { StartScreen } from "../../src/hud/StartScreen.tsx";
import { StatusPill } from "../../src/hud/StatusPill.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { useConnectionStore } from "../../src/store/connection.ts";
import { useRoomStore } from "../../src/store/room.ts";
import { give } from "../game/fixtures.ts";
import {
  actions,
  byText,
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
  localStorage.clear();
  calls = recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
  localStorage.clear();
});

function lobbyWith(count: number, me: Seat = 0): void {
  act(() =>
    useRoomStore.setState({
      room: "K7QX2M",
      seat: me,
      host: 0,
      status: "lobby",
      seats: ["Ana", "Ben", "Cy", "Dee", "Eve", "Fin"].slice(0, count).map((name, i) => ({
        seat: i,
        name,
        connected: true,
        bot: false,
        avatar: AVATAR_IDS[i] as AvatarId,
      })),
    }),
  );
}

const target = () => m.container.querySelector('[data-testid="victory-target"]');
const targetButton = (n: number) => byText(target()!, "button", String(n));

describe("Lobby victory target", () => {
  it("offers 8 to 15 with 10 selected, and sends the pick on start", () => {
    lobbyWith(3);
    m = mount(<Lobby inviteLink="l" />);
    const options = [...target()!.querySelectorAll("button")].map((b) => b.textContent);
    expect(options).toEqual(["8", "9", "10", "11", "12", "13", "14", "15"]);
    expect(targetButton(10)?.getAttribute("aria-checked")).toBe("true");
    click(targetButton(12));
    click(byText(m.container, "button", "Start game"));
    expect(calls).toEqual([{ fn: "startGame", args: ["variable", undefined, "standard", 12] }]);
    expect(localStorage.getItem(VICTORY_TARGET_KEY)).toBe("12");
  });

  it("preselects the remembered target and ignores junk", () => {
    localStorage.setItem(VICTORY_TARGET_KEY, "8");
    expect(loadVictoryTarget()).toBe(8);
    localStorage.setItem(VICTORY_TARGET_KEY, "20");
    expect(loadVictoryTarget()).toBe(10);
  });

  it("guests see no target control", () => {
    lobbyWith(3, 1);
    m = mount(<Lobby inviteLink="l" />);
    expect(target()).toBeNull();
  });
});

describe("Lobby large board", () => {
  it("notes the large board at 5 seats and starts it as a variable game", () => {
    lobbyWith(5);
    m = mount(<Lobby inviteLink="l" />);
    expect(m.container.querySelector('[data-testid="large-board-note"]')?.textContent).toContain(
      "5–6 players: large board",
    );
    expect(m.container.querySelector('input[name="hud-mode"][value="beginner"]')).toBeNull();
    click(byText(m.container, "button", "Start game"));
    expect(calls[0]?.args[0]).toBe("variable");
  });

  it("shows no note with 4 seats", () => {
    lobbyWith(4);
    m = mount(<Lobby inviteLink="l" />);
    expect(m.container.querySelector('[data-testid="large-board-note"]')).toBeNull();
  });
});

describe("Play solo with more bots", () => {
  it("offers 2 to 5 opponents and notes the large board for 4 or 5", () => {
    act(() => useConnectionStore.setState({ status: "open" }));
    m = mount(<StartScreen />);
    const input = m.container.querySelector("input")!;
    act(() => {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
      desc.set!.call(input, "Ana");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const group = m.container.querySelector('[data-testid="solo-opponents"]')!;
    expect(group.querySelectorAll("button")).toHaveLength(4);
    expect(m.container.querySelector('[data-testid="solo-large-board"]')).toBeNull();
    click(group.querySelectorAll("button")[3]);
    expect(m.container.querySelector('[data-testid="solo-large-board"]')).not.toBeNull();
    click(byText(m.container, "button", "Play solo vs bots"));
    expect(calls.find((c) => c.fn === "playSolo")?.args[1]).toBe(5);
  });
});

/** A 6-player game in the main turn of seat 0, after the roll. */
function sixPlayers(victoryTarget = 10): GameState {
  const s = createGame({
    seed: 3,
    playerCount: 6,
    mode: "variable",
    startingPlayer: 0,
    victoryTarget,
  });
  s.phase = { kind: "turn" };
  s.turn = { seat: 0, number: 1, rolled: true, devPlayed: false, dice: [3, 4] };
  s.log = [];
  return s;
}

/** Seat 0 ended; seat 1's building window is open, then seats 2–5. */
function windowOf(current: Seat): GameState {
  const s = sixPlayers();
  s.phase = {
    kind: "specialBuild",
    current,
    queue: [2, 3, 4, 5].filter((x) => x > current),
    afterTurnOf: 0,
  };
  return s;
}

describe("Six player panels", () => {
  it("shows six panels in one row, crowded: phones keep only VP", () => {
    seatRoom(0, 6);
    showGame(sixPlayers(), 0);
    m = mount(<PlayerPanels />);
    const list = m.container.querySelector("ol")!;
    expect(list.getAttribute("data-crowded")).toBe("true");
    expect(list.className).toContain("flex-nowrap");
    const panels = m.container.querySelectorAll('[data-testid="player-panel"]');
    expect(panels).toHaveLength(6);
    for (const p of panels) {
      expect(p.querySelector('[data-chip="vp"]')?.className).not.toContain("max-sm:hidden");
      for (const stat of ["cards", "dev", "knights"]) {
        expect(p.querySelector(`[data-chip="${stat}"]`)?.className).toContain("max-sm:hidden");
      }
    }
  });

  it("is not crowded with four seats", () => {
    seatRoom(0, 4);
    showGame(createGame({ seed: 1, playerCount: 4, mode: "beginner" }), 0);
    m = mount(<PlayerPanels />);
    expect(m.container.querySelector("ol")?.hasAttribute("data-crowded")).toBe(false);
  });
});

describe("Goal chip", () => {
  it("shows the victory target", () => {
    seatRoom(0, 6);
    showGame(sixPlayers(12), 0);
    m = mount(<StatusPill />);
    expect(m.container.querySelector('[data-testid="goal-chip"]')?.textContent).toBe("Goal: 12 VP");
  });
});

describe("Special Building Phase controls", () => {
  it("my window: build, buy and Done building only", () => {
    const s = windowOf(1);
    give(s, 1, { brick: 1, lumber: 1 });
    seatRoom(1, 6);
    showGame(s, 1);
    m = mount(
      <>
        <StatusPill />
        <ActionButtons />
      </>,
    );
    expect(m.container.querySelector('[data-testid="turn-status"]')?.textContent).toBe(
      "Your building window: build, buy or pass",
    );
    const buttons = m.container.querySelector('[data-testid="action-buttons"]')!;
    expect(buttons.querySelector('[aria-label="Trade with bank"]')).toBeNull();
    expect(buttons.querySelector('[aria-label="Trade with players"]')).toBeNull();
    expect(buttons.querySelector('[aria-label="End turn"]')).toBeNull();
    const pass = buttons.querySelector<HTMLButtonElement>('[aria-label="Done building"]')!;
    expect(pass.disabled).toBe(false);
    click(pass);
    expect(actions(calls)).toEqual([{ type: "passSpecialBuild" }]);
  });

  it("someone else's window: the status names them and I have no controls", () => {
    seatRoom(3, 6);
    showGame(windowOf(1), 3);
    m = mount(
      <>
        <StatusPill />
        <ActionButtons />
      </>,
    );
    expect(m.container.querySelector('[data-testid="turn-status"]')?.textContent).toBe(
      "Ben is building",
    );
    expect(m.container.querySelector('[data-testid="action-buttons"]')).toBeNull();
  });
});
