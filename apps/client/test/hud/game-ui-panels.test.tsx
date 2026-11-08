// Player panels, status pill, dice tray and feed (moved from game-ui.test.tsx).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { EventLog, GameOver, Rejection, REJECTION_MS, Toasts } from "../../src/hud/Feed.tsx";
import { PlayerPanels } from "../../src/hud/PlayerPanels.tsx";
import { StatusPill } from "../../src/hud/StatusPill.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { DiceTray, THROW_MS } from "../../src/hud/dice/DiceTray.tsx";
import { setDiceSettled } from "../../src/store/dice.ts";
import { DEFAULT_DOCK, setDiceDock } from "../../src/store/dock.ts";
import { createGame } from "@hexfall/engine";
import { useConnectionStore } from "../../src/store/connection.ts";
import { useGameStore } from "../../src/store/game.ts";
import { useRoomStore } from "../../src/store/room.ts";
import { i18n } from "../../src/i18n/index.ts";
import { give, playState, put } from "../game/fixtures.ts";
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

const held = vi.hoisted(() => [] as boolean[]);
vi.mock("../../src/audio/music.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/audio/music.ts")>()),
  holdMusic: (on: boolean) => held.push(on),
}));

let m: Mounted;
let calls: Call[];

beforeEach(() => {
  resetAll();
  calls = recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
  vi.useRealTimers();
});

describe("PlayerPanels", () => {
  it("shows counts but never an opponent's card types", () => {
    const s = playState();
    give(s, 1, { brick: 3, ore: 2 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(<PlayerPanels />);
    const panels = m.container.querySelectorAll('[data-testid="player-panel"]');
    expect(panels).toHaveLength(4);
    expect(panels[1]?.querySelector('[data-stat="cards"]')?.textContent).toBe("5");
    expect(panels[1]?.textContent).not.toMatch(/brick|ore/i);
    expect(panels[0]?.getAttribute("data-active")).toBe("true");
  });

  it("highlights only the current seat's card, follows the turn, none when ended", () => {
    const active = () =>
      [...m.container.querySelectorAll('[data-testid="player-panel"]')].map(
        (el) => el.hasAttribute("data-active") && el.getAttribute("aria-current") === "true",
      );
    const s = playState();
    seatRoom(0);
    showGame(s, 0);
    m = mount(<PlayerPanels />);
    expect(active()).toEqual([true, false, false, false]);
    expect(m.container.querySelector(".player-card")).not.toBeNull();
    s.turn.seat = 2;
    showGame(s, 0);
    expect(active()).toEqual([false, false, true, false]);
    s.phase = { kind: "ended" };
    showGame(s, 0);
    expect(active()).toEqual([false, false, false, false]);
  });

  it("keeps one non-wrapping row of panels (fixed top container)", () => {
    const s = playState();
    s.longestRoad = 2;
    seatRoom(0);
    showGame(s, 0);
    m = mount(<PlayerPanels />);
    const list = m.container.querySelector("ol")!;
    expect(list.className).toContain("flex-nowrap");
    expect(list.className).not.toContain("flex-wrap");
    expect(m.container.querySelectorAll('[data-testid="player-panel"]')).toHaveLength(4);
  });

  it("marks disconnected seats, the viewer, and special cards", () => {
    const s = playState();
    s.longestRoad = 2;
    s.players[0]!.devCards = ["victoryPoint"];
    put(s, 10, 0);
    seatRoom(0, 4, [true, true, false, true]);
    showGame(s, 0);
    m = mount(<PlayerPanels />);
    const panels = m.container.querySelectorAll('[data-testid="player-panel"]');
    expect(panels[2]?.querySelector('[data-testid="offline"]')).not.toBeNull();
    expect(panels[2]?.textContent).toContain("Longest Road");
    expect(panels[0]?.textContent).toContain("you");
    expect(panels[0]?.textContent).toContain("2 VP with hidden cards");
    expect(panels[1]?.textContent).not.toContain("hidden");
  });

  it("shows four icon chips in order with accessible labels and no abbreviations", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<PlayerPanels />);
    const panel = m.container.querySelector('[data-testid="player-panel"]')!;
    const stats = [...panel.querySelectorAll("dd[data-stat]")].map((d) =>
      d.getAttribute("data-stat"),
    );
    expect(stats).toEqual(["vp", "cards", "dev", "knights"]);
    expect(panel.querySelectorAll("dt img")).toHaveLength(4);
    const dts = [...panel.querySelectorAll("dt")].map((d) => d.textContent);
    expect(dts).toEqual([
      "Victory points",
      "Resource cards",
      "Development cards",
      "Knights played",
    ]);
    expect(panel.textContent).not.toMatch(/\b(Crd|Kn)\b/);
  });

  it("shows special cards as medals, not text badges, and only for the holder", () => {
    const s = playState();
    s.longestRoad = 2;
    s.largestArmy = 1;
    seatRoom(0);
    showGame(s, 0);
    m = mount(<PlayerPanels />);
    const panels = m.container.querySelectorAll('[data-testid="player-panel"]');
    expect(panels[2]?.querySelectorAll('[data-testid="medal"]')).toHaveLength(1);
    expect(panels[2]?.querySelector('[data-testid="medal"]')?.getAttribute("title")).toBe(
      "Longest Road",
    );
    expect(panels[1]?.querySelector('[data-testid="medal"]')?.getAttribute("title")).toBe(
      "Largest Army",
    );
    expect(panels[0]?.querySelector('[data-testid="medal"]')).toBeNull();
    expect(panels[2]?.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it("shows hidden VP as +n on the viewer's VP chip only", () => {
    const s = playState();
    s.players[0]!.devCards = ["victoryPoint", "victoryPoint"];
    seatRoom(0);
    showGame(s, 0);
    m = mount(<PlayerPanels />);
    const panels = m.container.querySelectorAll('[data-testid="player-panel"]');
    expect(panels[0]?.querySelector("[title='Only you can see this']")?.textContent).toContain(
      "+2",
    );
    expect(panels[1]?.querySelector("[title='Only you can see this']")).toBeNull();
  });
});

describe("status pill and End turn", () => {
  const status = () => m.container.querySelector('[data-testid="turn-status"]');
  const endTurn = () =>
    m.container.querySelector<HTMLButtonElement>('button[aria-label="End turn"]');

  it("before the roll: status says roll, End turn off, and no roll buttons", () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0);
    m = mount(
      <>
        <StatusPill />
        <ActionButtons />
      </>,
    );
    expect(status()?.textContent).toBe("Roll the dice");
    expect(status()?.hasAttribute("data-your-move")).toBe(true);
    expect(endTurn()!.disabled).toBe(true);
    expect(byText(m.container, "button", /Roll/)).toBeUndefined();
  });

  it("waiting on another player: status names them and there is no End turn", () => {
    seatRoom(0);
    showGame(playState({ seat: 2 }), 0);
    m = mount(
      <>
        <StatusPill />
        <ActionButtons />
      </>,
    );
    expect(status()?.textContent).toBe("Cy's turn");
    expect(status()?.hasAttribute("data-your-move")).toBe(false);
    expect(endTurn()).toBeNull();
  });

  it("End turn sends endTurn after the roll", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<ActionButtons />);
    click(endTurn());
    expect(actions(calls)).toEqual([{ type: "endTurn" }]);
  });
});

describe("DiceTray", () => {
  const dice = () => m.container.querySelector<HTMLButtonElement>('[data-testid="dice"]')!;

  it("is the Roll dice control before the roll and sends rollDice once", () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0);
    m = mount(<DiceTray />);
    expect(dice().getAttribute("aria-label")).toBe("Roll dice");
    expect(dice().disabled).toBe(false);
    click(dice());
    expect(actions(calls)).toEqual([{ type: "rollDice" }]);
  });

  it("a second click while the roll is in flight sends nothing", () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0);
    m = mount(<DiceTray />);
    click(dice());
    act(() => useGameStore.setState({ inFlight: true }));
    expect(dice().disabled).toBe(true);
    act(() => dice().click());
    expect(actions(calls)).toEqual([{ type: "rollDice" }]);
  });

  it("is the Roll for order control during the roll for order", () => {
    seatRoom(0);
    showGame(createGame({ seed: 1, playerCount: 4, mode: "beginner" }), 0);
    m = mount(<DiceTray />);
    expect(dice().getAttribute("aria-label")).toBe("Roll for order");
    click(dice());
    expect(actions(calls)).toEqual([{ type: "rollForOrder" }]);
  });

  it("waiting on another player disables the dice", () => {
    seatRoom(0);
    showGame(playState({ seat: 2 }), 0);
    m = mount(<DiceTray />);
    expect(dice().disabled).toBe(true);
  });

  it("is off while an action is in flight or the connection is not open", () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0, { inFlight: true });
    m = mount(<DiceTray />);
    expect(dice().disabled).toBe(true);
    act(() => useGameStore.setState({ inFlight: false }));
    expect(dice().disabled).toBe(false);
    act(() => useConnectionStore.setState({ status: "reconnecting" }));
    expect(dice().disabled).toBe(true);
    act(() => useConnectionStore.setState({ status: "replaced" }));
    expect(dice().disabled).toBe(true);
  });

  it("announces a snapshot roll to everyone at once", () => {
    seatRoom(2);
    showGame(playState(), 2, {
      log: [{ type: "diceRolled", seat: 0, dice: [3, 4], total: 7 }],
    });
    m = mount(<DiceTray />);
    expect(dice().getAttribute("aria-label")).toBe("Rolled 3 and 4, total 7");
    expect(m.container.querySelector('[data-testid="dice-announce"]')?.textContent).toBe(
      "Rolled 3 and 4, total 7",
    );
    expect(m.container.querySelector("[data-rolling]")).toBeNull();
  });

  it("throws an update roll, then announces it once the dice settle", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
    seatRoom(2);
    showGame(playState(), 2, { log: [] });
    m = mount(<DiceTray />);
    act(() =>
      useGameStore.setState({
        source: "update",
        log: [{ type: "diceRolled", seat: 0, dice: [5, 2], total: 7 }],
      }),
    );
    expect(m.container.querySelector("[data-rolling]")).not.toBeNull();
    expect(m.container.querySelector('[data-testid="dice-announce"]')?.textContent).toBe("");
    // The board dice come to rest (spec board-dice: Announced on rest).
    act(() => setDiceSettled(0));
    expect(m.container.querySelector('[data-testid="dice-announce"]')?.textContent).toBe(
      "Rolled 5 and 2, total 7",
    );
    expect(m.container.querySelector("[data-rolling]")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("settles on its own if the board dice never report rest", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
    seatRoom(2);
    showGame(playState(), 2, { log: [] });
    m = mount(<DiceTray />);
    act(() =>
      useGameStore.setState({
        source: "update",
        log: [{ type: "diceRolled", seat: 0, dice: [1, 3], total: 4 }],
      }),
    );
    act(() => {
      vi.advanceTimersByTime(THROW_MS - 100);
    });
    expect(m.container.querySelector('[data-testid="dice-announce"]')?.textContent).toBe("");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(m.container.querySelector('[data-testid="dice-announce"]')?.textContent).toBe(
      "Rolled 1 and 3, total 4",
    );
    vi.unstubAllGlobals();
  });

  const visual = () => m.container.querySelector<HTMLElement>('[data-testid="dice-tray"] > div')!;

  it("is drawn only while the viewer has a roll to make", () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0);
    m = mount(<DiceTray />);
    expect(visual().hidden).toBe(false);
    expect(m.container.querySelector('[data-testid="dice-total"]')).toBeNull(); // no number
    m.unmount();
    // Own turn after the roll: nothing left to roll, the 3D dice show the values.
    showGame(playState({ rolled: true }), 0, {
      log: [{ type: "diceRolled", seat: 0, dice: [2, 3], total: 5 }],
    });
    m = mount(<DiceTray />);
    expect(visual().hidden).toBe(true);
    expect(m.container.querySelector('[data-testid="dice-announce"]')?.textContent).toBe(
      "Rolled 2 and 3, total 5",
    );
  });

  it("is hidden on another player's turn but still announces the roll (the 3D dice show it)", () => {
    seatRoom(2);
    showGame(playState(), 2, {
      log: [{ type: "diceRolled", seat: 0, dice: [6, 1], total: 7 }],
    });
    m = mount(<DiceTray />);
    expect(visual().hidden).toBe(true);
    const tray = m.container.querySelector('[data-testid="dice-tray"]')!;
    expect(tray.hasAttribute("data-shown")).toBe(false);
    expect(m.container.querySelector('[data-testid="dice-announce"]')?.textContent).toBe(
      "Rolled 6 and 1, total 7",
    );
  });

  it("is drawn for the viewer's own roll for order", () => {
    seatRoom(0);
    showGame(createGame({ seed: 1, playerCount: 4, mode: "beginner" }), 0);
    m = mount(<DiceTray />);
    expect(visual().hidden).toBe(false);
  });

  it("docks where the HUD says", () => {
    seatRoom(0);
    showGame(playState(), 0);
    act(() => setDiceDock({ right: 342, bottom: 260 }));
    m = mount(<DiceTray />);
    const tray = m.container.querySelector<HTMLElement>('[data-testid="dice-tray"]')!;
    expect(tray.style.right).toBe("342px");
    expect(tray.style.bottom).toBe("260px");
    act(() => setDiceDock(DEFAULT_DOCK));
  });
});

describe("feed", () => {
  it("log says so when there are no events yet", () => {
    seatRoom(0);
    showGame(playState(), 0, { log: [] });
    m = mount(<EventLog />);
    expect(m.container.querySelector('[data-testid="log-empty"]')?.textContent).toBe(
      "No events yet.",
    );
    expect(m.container.querySelectorAll('[data-testid="log-line"]')).toHaveLength(0);
  });

  it("log uses redacted wording for others' steals", () => {
    seatRoom(2);
    showGame(playState(), 2, {
      log: [{ type: "stole", thief: 0, victim: 1, resource: null }],
    });
    m = mount(<EventLog />);
    expect(m.container.querySelector('[data-testid="log-line"]')?.textContent).toBe(
      "Ana stole a card from Ben.",
    );
  });

  it("an update with turnStarted for the viewer toasts Your turn; snapshots never toast", () => {
    seatRoom(1);
    showGame(playState({ seat: 1 }), 1);
    m = mount(<Toasts />);
    const e = { type: "turnStarted" as const, seat: 1, number: 2 };
    act(() => useGameStore.setState({ source: "snapshot", lastEvents: [e] }));
    expect(m.container.querySelectorAll('[data-testid="toast"]')).toHaveLength(0);
    act(() => useGameStore.setState({ source: "update", lastEvents: [e] }));
    expect(m.container.querySelector('[data-testid="toast"]')?.textContent).toContain("Your turn");
  });

  it("rejection shows plain words and hides on its own", () => {
    vi.useFakeTimers();
    m = mount(<Rejection />);
    act(() =>
      useGameStore.setState({
        rejection: { code: "insufficient_resources", message: "x", id: 1 },
      }),
    );
    const alert = m.container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("You do not have enough resources.");
    expect(alert?.textContent).toContain("insufficient_resources");
    act(() => {
      vi.advanceTimersByTime(REJECTION_MS);
    });
    expect(m.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("game over shows the winner and final VP, back to start calls the session", () => {
    const s = playState();
    s.phase = { kind: "ended" };
    s.winner = 3;
    for (const v of [0, 8, 16]) put(s, v, 3, "city");
    s.players[3]!.devCards = ["victoryPoint"];
    seatRoom(0);
    showGame(s, 0);
    m = mount(<GameOver />);
    // The dialog portals out of the mounted container (no HUD root in this test).
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toContain("Dee wins!");
    expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("Game over");
    const first = document.querySelector("tbody tr");
    expect(first?.textContent).toContain("Dee");
    expect(first?.textContent).toContain("7");
    expect(first?.textContent).toContain("incl. 1 VP card");
    click(byText(document.body, "button", "Back to start"));
    expect(calls).toEqual([{ fn: "backToStart", args: [] }]);
  });

  it("game over holds the background music while it is up and releases it after", () => {
    const s = playState();
    seatRoom(0);
    showGame(s, 0);
    held.length = 0;
    m = mount(<GameOver />);
    expect(held.at(-1)).toBe(false);
    s.phase = { kind: "ended" };
    s.winner = 1;
    showGame(s, 0);
    expect(held.at(-1)).toBe(true);
    m.unmount();
    expect(held.at(-1)).toBe(false);
  });
});

describe("bot badge (trade-with-bots)", () => {
  /** Marks seats as bots; `open` seats are also open seats. */
  function bots(seats: number[], open: number[] = []) {
    act(() =>
      useRoomStore.setState((st) => ({
        seats: st.seats.map((x) =>
          seats.includes(x.seat)
            ? { ...x, bot: true, ...(open.includes(x.seat) ? { open: true } : {}) }
            : x,
        ),
      })),
    );
  }
  const badgeOf = (i: number) =>
    m.container
      .querySelectorAll('[data-testid="player-panel"]')
      [i]?.querySelector('[data-testid="bot-seat"]');

  afterEach(async () => {
    await act(() => i18n.changeLanguage("en"));
  });

  it("marks bot seats and not the human", () => {
    seatRoom(0, 3);
    bots([1, 2]);
    showGame(playState({ playerCount: 3 }), 0);
    m = mount(<PlayerPanels />);
    expect(badgeOf(0)).toBeNull();
    expect(badgeOf(1)?.textContent).toContain("Bot");
    expect(badgeOf(2)?.getAttribute("title")).toBe("Played by the computer");
  });

  it("keeps the open-seat badge instead of the bot badge", () => {
    seatRoom(0, 3);
    bots([1, 2], [1]);
    showGame(playState({ playerCount: 3 }), 0);
    m = mount(<PlayerPanels />);
    const panel = m.container.querySelectorAll('[data-testid="player-panel"]')[1];
    expect(panel?.querySelector('[data-testid="open-seat"]')).not.toBeNull();
    expect(badgeOf(1)).toBeNull();
    expect(badgeOf(2)).not.toBeNull();
  });

  it("has a Spanish tooltip", async () => {
    await act(() => i18n.changeLanguage("es"));
    seatRoom(0, 3);
    bots([1]);
    showGame(playState({ playerCount: 3 }), 0);
    m = mount(<PlayerPanels />);
    expect(badgeOf(1)?.getAttribute("title")).toBe("Lo juega el ordenador");
  });
});
