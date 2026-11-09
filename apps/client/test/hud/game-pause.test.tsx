// Host pause/end controls, paused notice, early-end scoreboard and the saved games list
// (openspec change pause-and-resume-games).
import type { EarlyResult } from "@hexfall/protocol";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { GameOver } from "../../src/hud/Feed.tsx";
import { GameMenu, PAUSED_KEEP_MS, PausedNotice, formatDate } from "../../src/hud/GamePause.tsx";
import { SavedGames } from "../../src/hud/SavedGames.tsx";
import { useRoomStore } from "../../src/store/room.ts";
import { sortSaved, useSavedGamesStore, type SavedGame } from "../../src/store/savedGames.ts";
import { playState } from "../game/fixtures.ts";
import {
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

let m: Mounted | undefined;
let calls: Call[];

beforeEach(() => {
  resetAll();
  act(() =>
    useSavedGamesStore.setState({ entries: [], loading: false, ending: null, error: null }),
  );
  calls = recordSession();
});
afterEach(() => {
  m?.unmount();
  m = undefined;
  resetAll();
});

const body = () => document.body;
const button = (text: string | RegExp) => byText(body(), "button", text);
const dialog = (id: string) => body().querySelector(`[data-testid="${id}"]`);
const intents = () => calls.filter((c) => c.fn !== "lookupSeats");

describe("game menu", () => {
  const menuButton = () => m?.container.querySelector('[data-testid="game-menu-button"]');

  it("is shown to every seated player while the game runs, with the leave icon", () => {
    seatRoom(1);
    m = mount(<GameMenu />);
    expect(menuButton()).not.toBeNull();
    expect(menuButton()?.querySelector("[data-icon]")?.getAttribute("data-icon")).toBe("leave");
    act(() => useRoomStore.setState({ status: "paused" }));
    expect(menuButton()).toBeNull();
    act(() => useRoomStore.setState({ status: "playing", seat: null }));
    expect(menuButton()).toBeNull();
  });

  it("Non-host menu contents: Leave game and the invite link, no host controls", () => {
    seatRoom(1);
    m = mount(<GameMenu />);
    click(menuButton());
    const menu = dialog("game-menu");
    expect(button(/Leave game/)).toBeDefined();
    expect(button(/Close game for now/)).toBeUndefined();
    expect(button(/End game now/)).toBeUndefined();
    expect(menu?.querySelector("input")?.value).toContain("room=K7QX2M");
  });

  it("Host menu keeps pause and end next to Leave game; pause icon only on Close", () => {
    seatRoom(0);
    m = mount(<GameMenu />);
    click(menuButton());
    expect(
      button(/Close game for now/)
        ?.querySelector("[data-icon]")
        ?.getAttribute("data-icon"),
    ).toBe("pause");
    expect(button(/End game now/)).toBeDefined();
    expect(
      button(/Leave game/)
        ?.querySelector("[data-icon]")
        ?.getAttribute("data-icon"),
    ).toBe("leave");
  });

  it("Non-host leaves from the menu: confirm sends leaveRoom once", () => {
    seatRoom(2);
    m = mount(<GameMenu />);
    click(menuButton());
    click(button(/Leave game/));
    expect(dialog("leave-confirm")?.textContent).toContain("A bot will play your seat");
    const confirm = byText(dialog("leave-confirm")!, "button", "Leave game");
    click(confirm);
    expect(intents()).toEqual([{ fn: "leaveRoom", args: [] }]);
    act(() => useRoomStore.setState({ pending: "leave" }));
    click(confirm);
    expect(intents()).toHaveLength(1);
  });

  it("Cancel: nothing is sent; a failed leave shows its error", () => {
    seatRoom(1);
    m = mount(<GameMenu />);
    click(menuButton());
    click(button(/Leave game/));
    click(button("Cancel"));
    expect(dialog("leave-confirm")).toBeNull();
    expect(intents()).toEqual([]);
    click(menuButton());
    click(button(/Leave game/));
    act(() =>
      useRoomStore.setState({
        error: { request: "leave", code: "unavailable", message: "store down" },
      }),
    );
    expect(dialog("leave-confirm")?.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("Host closes the game: confirm sends pauseGame once", () => {
    seatRoom(0);
    m = mount(<GameMenu />);
    click(m.container.querySelector('[data-testid="game-menu-button"]'));
    click(button(/Close game for now/));
    expect(dialog("pause-confirm")?.textContent).toContain("7 days");
    const confirm = byText(dialog("pause-confirm")!, "button", "Close game for now");
    click(confirm);
    expect(intents()).toEqual([{ fn: "pauseGame", args: [] }]);
    // The request is pending: a second click sends nothing.
    act(() => useRoomStore.setState({ pending: "pause" }));
    click(confirm);
    expect(intents()).toHaveLength(1);
  });

  it("Host cancels the end: nothing is sent; confirming sends endGame once", () => {
    seatRoom(0);
    m = mount(<GameMenu />);
    click(m.container.querySelector('[data-testid="game-menu-button"]'));
    click(button(/End game now/));
    expect(dialog("end-confirm")?.textContent).toContain("cannot be undone");
    click(button("Cancel"));
    expect(dialog("end-confirm")).toBeNull();
    expect(intents()).toEqual([]);
    click(m.container.querySelector('[data-testid="game-menu-button"]'));
    click(button(/End game now/));
    click(byText(dialog("end-confirm")!, "button", "End game now"));
    expect(intents()).toEqual([{ fn: "endGame", args: [] }]);
  });
});

describe("paused notice", () => {
  it("Player sees the pause: expiry date, no Resume button", () => {
    seatRoom(2);
    act(() => useRoomStore.setState({ status: "paused", pausedAt: 1_000 }));
    m = mount(<PausedNotice />);
    const notice = dialog("paused-notice");
    expect(notice?.textContent).toContain("Paused by the host");
    expect(notice?.textContent).toContain(formatDate(1_000 + PAUSED_KEEP_MS, "en"));
    expect(notice?.getAttribute("role")).toBe("alertdialog");
    expect(button(/Resume game/)).toBeUndefined();
    const rows = [...(dialog("paused-actions")?.querySelectorAll("button") ?? [])];
    expect(rows.map((b) => b.querySelector("[data-icon]")?.getAttribute("data-icon"))).toEqual([
      "home",
      "leave",
    ]);
  });

  it("Host sees three stacked actions: Resume, End, Leave, each with icon and hint", () => {
    seatRoom(0);
    act(() => useRoomStore.setState({ status: "paused", pausedAt: 1_000 }));
    m = mount(<PausedNotice />);
    const actions = dialog("paused-actions");
    expect(actions?.className).toContain("flex-col");
    const rows = [...(actions?.querySelectorAll("button") ?? [])];
    expect(rows.map((b) => b.querySelector("[data-icon]")?.getAttribute("data-icon"))).toEqual([
      "resume",
      "end-game",
      "home",
      "leave",
    ]);
    expect(rows[0]?.textContent).toContain("Resume game");
    expect(rows[0]?.textContent).toContain("Everyone continues from where you left off.");
    expect(rows[1]?.textContent).toContain("The player with the most VP wins.");
    expect(rows[2]?.textContent).toContain("Play another game");
    expect(rows[2]?.textContent).toContain("Your seat stays saved");
    expect(rows[3]?.textContent).toContain("A bot plays your seat");
    for (const row of rows) expect(row.className).toContain("w-full");
    expect(dialog("paused-notice")?.querySelector(".justify-end")).toBeNull();
  });

  it("Play another game goes back to the start screen and keeps the seat", () => {
    seatRoom(2);
    act(() => useRoomStore.setState({ status: "paused", pausedAt: 1_000 }));
    m = mount(<PausedNotice />);
    click(byText(dialog("paused-actions")!, "button", /Play another game/));
    expect(intents()).toEqual([{ fn: "backToStart", args: [{ keepSeat: true }] }]);
  });

  it("Anyone can leave from the paused notice", () => {
    seatRoom(2);
    act(() => useRoomStore.setState({ status: "paused", pausedAt: 1_000 }));
    m = mount(<PausedNotice />);
    click(byText(dialog("paused-notice")!, "button", /Leave game/));
    click(byText(dialog("leave-confirm")!, "button", "Leave game"));
    expect(intents()).toEqual([{ fn: "leaveRoom", args: [] }]);
  });

  it("Host resumes from the notice; it closes when the playing state arrives", () => {
    seatRoom(0);
    act(() => useRoomStore.setState({ status: "paused", pausedAt: 1_000 }));
    m = mount(<PausedNotice />);
    click(button(/Resume game/));
    expect(intents()).toEqual([{ fn: "resumeGame", args: [] }]);
    act(() => useRoomStore.setState({ status: "playing", pausedAt: null }));
    expect(dialog("paused-notice")).toBeNull();
  });

  it("Host ends from the notice after confirming", () => {
    seatRoom(0);
    act(() => useRoomStore.setState({ status: "paused", pausedAt: 1_000 }));
    m = mount(<PausedNotice />);
    click(byText(dialog("paused-actions")!, "button", /End game/));
    click(byText(dialog("end-confirm")!, "button", "End game now"));
    expect(intents()).toEqual([{ fn: "endGame", args: [] }]);
    const result: EarlyResult = { reason: "host", at: 1, winners: [0], scores: [] };
    act(() => useRoomStore.setState({ status: "ended", pausedAt: null, result }));
    expect(dialog("paused-notice")).toBeNull();
  });
});

describe("early-end scoreboard", () => {
  it("Shared win shown: ended by the host, both names, both rows bold", () => {
    seatRoom(1);
    showGame(playState(), 1);
    const result: EarlyResult = {
      reason: "host",
      at: 5,
      winners: [0, 2],
      scores: [
        { seat: 0, vp: 8, hiddenVp: 1 },
        { seat: 1, vp: 6, hiddenVp: 0 },
        { seat: 2, vp: 8, hiddenVp: 0 },
        { seat: 3, vp: 4, hiddenVp: 0 },
      ],
    };
    act(() => useRoomStore.setState({ status: "ended", result }));
    m = mount(<GameOver />);
    expect(body().querySelector('[role="dialog"] h2')?.textContent).toContain(
      "Ana and Cy share the win!",
    );
    expect(dialog("ended-by-host")?.textContent).toBe("Ended by the host");
    const rows = [...body().querySelectorAll("tbody tr")];
    expect(rows.map((r) => r.hasAttribute("data-winner"))).toEqual([true, true, false, false]);
    expect(rows[0]?.textContent).toContain("incl. 1 VP card");
    click(button("Back to start"));
    expect(intents()).toEqual([{ fn: "backToStart", args: [] }]);
  });

  it("a single early winner reads like a normal win", () => {
    seatRoom(1);
    showGame(playState(), 1);
    const result: EarlyResult = {
      reason: "host",
      at: 5,
      winners: [3],
      scores: [0, 1, 2, 3].map((seat) => ({ seat, vp: seat === 3 ? 9 : 2, hiddenVp: 0 })),
    };
    act(() => useRoomStore.setState({ status: "ended", result }));
    m = mount(<GameOver />);
    expect(body().querySelector('[role="dialog"] h2')?.textContent).toContain("Dee wins!");
  });
});

describe("saved games list", () => {
  const game = (room: string, status: SavedGame["status"], usedAt: number): SavedGame => ({
    room,
    status,
    seat: 1,
    host: 0,
    names: ["Ana", "Ben", "Cy"],
    bots: [false, false, false],
    turn: status === "lobby" ? null : 12,
    pausedAt: status === "paused" ? 1 : null,
    expiresAt: status === "paused" ? 2_000_000 : 9,
    createdAt: 1_000_000,
    startedAt: status === "lobby" ? null : 1_500_000,
    lastActiveAt: status === "lobby" ? null : 1_800_000,
    usedAt,
  });

  it("orders paused and playing first, most recent first, then lobby", () => {
    const sorted = sortSaved([
      game("LOBBY1", "lobby", 50),
      game("PLAY01", "playing", 10),
      game("PAUSE1", "paused", 20),
    ]);
    expect(sorted.map((g) => g.room)).toEqual(["PAUSE1", "PLAY01", "LOBBY1"]);
  });

  it("looks up on show, renders entries, Continue resumes and Remove forgets", () => {
    m = mount(<SavedGames busy={false} />);
    expect(calls).toEqual([{ fn: "lookupSeats", args: [] }]);
    expect(m.container.textContent).toBe("");
    act(() => useSavedGamesStore.setState({ loading: true }));
    expect(m.container.textContent).toContain("Checking your games");
    act(() =>
      useSavedGamesStore.setState({
        loading: false,
        entries: [game("PAUSE1", "paused", 2), game("LOBBY1", "lobby", 1)],
      }),
    );
    const items = [...m.container.querySelectorAll('[data-testid="saved-game"]')];
    expect(items.map((i) => i.getAttribute("data-room"))).toEqual(["PAUSE1", "LOBBY1"]);
    expect(items[0]?.textContent).toContain("Paused by the host");
    expect(items[0]?.textContent).toContain("Turn 12");
    expect(items[0]?.textContent).toContain("Ben (you)");
    expect(items[0]?.textContent).toContain(`Saved until ${formatDate(2_000_000, "en")}`);
    expect(items[1]?.textContent).toContain("Waiting in the lobby");
    expect(items[1]?.textContent).not.toContain("Saved until");
    click(byText(items[0]!, "button", "Continue"));
    click(items[1]!.querySelector('[aria-label="Remove room LOBBY1 from this list"]'));
    expect(intents()).toEqual([
      { fn: "continueGame", args: ["PAUSE1"] },
      { fn: "forgetGame", args: ["LOBBY1"] },
    ]);
  });

  it("shows when each game started and its last move, so games are easy to tell apart", () => {
    act(() =>
      useSavedGamesStore.setState({
        entries: [game("PLAY01", "playing", 2), game("LOBBY1", "lobby", 1)],
      }),
    );
    m = mount(<SavedGames busy={false} />);
    const dates = [...m.container.querySelectorAll('[data-testid="saved-dates"]')];
    expect(dates[0]?.textContent).toBe(
      `Started ${formatDate(1_500_000, "en")} · last move ${formatDate(1_800_000, "en")}`,
    );
    expect(dates[1]?.textContent).toBe(`Created ${formatDate(1_000_000, "en")}`);
  });

  it("the host can end a running or paused game from the list after confirming", () => {
    const host = (room: string, status: SavedGame["status"]) => ({
      ...game(room, status, 1),
      seat: 0,
    });
    act(() =>
      useSavedGamesStore.setState({
        entries: [host("PLAY01", "playing"), host("LOBBY1", "lobby"), game("OTHER1", "paused", 1)],
      }),
    );
    m = mount(<SavedGames busy={false} />);
    const endButton = (room: string) =>
      m!.container.querySelector(`[aria-label="End the game in room ${room}"]`);
    expect(endButton("LOBBY1")).toBeNull(); // not started
    expect(endButton("OTHER1")).toBeNull(); // not the host
    click(endButton("PLAY01"));
    expect(dialog("end-confirm")?.textContent).toContain("cannot be undone");
    click(button("Cancel"));
    expect(intents()).toEqual([]);
    click(endButton("PLAY01"));
    click(byText(dialog("end-confirm")!, "button", "End game now"));
    expect(intents()).toEqual([{ fn: "endSavedGame", args: ["PLAY01"] }]);
    act(() =>
      useSavedGamesStore.setState({
        ending: null,
        error: { room: "PLAY01", code: "unavailable", message: "x" },
      }),
    );
    expect(dialog("end-confirm")?.textContent).toContain("The server is busy");
  });
});
