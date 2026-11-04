// Floating controls, edge hand and countdown display (openspec floating-hud-turn-timer, tasks
// 5.1–5.6 and 6.4; specs/game-hud "Turn status and controls", "Own hand", "Turn countdown";
// specs/hud-presentation "Development cards as cards").
import { type Phase, createGame } from "@hexfall/engine";
import { Route } from "lucide-react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { TooltipProvider } from "../../src/components/ui/tooltip.tsx";
import { DiscardDialog } from "../../src/hud/Dialogs.tsx";
import { Hand } from "../../src/hud/Hand.tsx";
import { Hud } from "../../src/hud/Hud.tsx";
import { PlayerPanels } from "../../src/hud/PlayerPanels.tsx";
import { CountdownAnnouncer, StatusPill } from "../../src/hud/StatusPill.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { Fab, RING_CIRCUMFERENCE } from "../../src/hud/actions/Fab.tsx";
import { GameCard } from "../../src/hud/cards/GameCard.tsx";
import { showBuildControls } from "../../src/game/status.ts";
import { useGameStore } from "../../src/store/game.ts";
import { setTurnFocus } from "../../src/store/ui.ts";
import { give, playState, put, seen } from "../game/fixtures.ts";
import {
  click,
  mount,
  recordSession,
  resetAll,
  seatRoom,
  showGame,
  type Mounted,
} from "./helpers.tsx";

let m: Mounted;

beforeEach(() => {
  resetAll();
  recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
  vi.useRealTimers();
});

const BUILD_NAMES = [
  "Build road",
  "Build settlement",
  "Build city",
  "Buy development card",
  "Trade with bank",
];

const fab = (name: string, root: ParentNode = document.body) =>
  root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
const describedBy = (btn: HTMLElement | null) =>
  document.getElementById(btn?.getAttribute("aria-describedby") ?? "")?.textContent ?? "";
const dice = () => document.querySelector<HTMLButtonElement>('[data-testid="dice"]');
const pillText = () => document.querySelector('[data-testid="turn-status"]')?.textContent;

/** A countdown in the game store, as a message carrying it would set it. */
function setTimer(
  kind: "roll" | "action",
  remainingMs: number,
  seats: number[],
  durationMs = 90_000,
): void {
  act(() =>
    useGameStore.setState({
      timer: { kind, durationMs, remainingMs, seats },
      timerAt: performance.now(),
    }),
  );
}

describe("showBuildControls", () => {
  it("is true only for the active viewer after setup", () => {
    const s = playState();
    expect(showBuildControls(seen(s, 0).view, 0)).toBe(true);
    expect(showBuildControls(seen(s, 1).view, 1)).toBe(false);
    expect(showBuildControls(seen(s, 0).view, null)).toBe(false);
    for (const phase of [
      { kind: "discard", owed: [0, 4, 0, 0] },
      { kind: "moveRobber", source: "seven" },
      { kind: "roadBuilding", remaining: 2 },
    ] satisfies Phase[]) {
      s.phase = phase;
      expect(showBuildControls(seen(s, 0).view, 0)).toBe(true);
    }
    s.phase = { kind: "ended" };
    s.winner = 0;
    expect(showBuildControls(seen(s, 0).view, 0)).toBe(false);
    const fresh = createGame({ seed: 1, playerCount: 4, mode: "beginner" });
    expect(showBuildControls(seen(fresh, 0).view, 0)).toBe(false);
  });
});

describe("Turn status and controls (full HUD)", () => {
  it("Before the roll: dice roll, End turn and build buttons visible but disabled", () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0);
    m = mount(<Hud />);
    expect(dice()?.getAttribute("aria-label")).toBe("Roll dice");
    expect(dice()?.disabled).toBe(false);
    for (const name of [...BUILD_NAMES, "End turn"]) {
      expect(fab(name), name).not.toBeNull();
      expect(fab(name)!.disabled, name).toBe(true);
    }
  });

  it("Waiting on another player: no End turn, build, buy or bank-trade button", () => {
    seatRoom(0);
    showGame(playState({ seat: 2 }), 0);
    m = mount(<Hud />);
    expect(pillText()).toBe("Cy's turn");
    expect(dice()?.disabled).toBe(true);
    for (const name of [...BUILD_NAMES, "End turn"]) expect(fab(name), name).toBeNull();
  });

  it("No build buttons during roll for order or setup", () => {
    seatRoom(0);
    const s = createGame({ seed: 1, playerCount: 4, mode: "beginner" });
    showGame(s, 0);
    m = mount(<Hud />);
    expect(dice()?.getAttribute("aria-label")).toBe("Roll for order");
    for (const name of [...BUILD_NAMES, "End turn"]) expect(fab(name), name).toBeNull();
  });

  it("Floating icon buttons: Build road enabled, round, no panel, cost tooltip, roads badge", () => {
    vi.useFakeTimers();
    const s = playState();
    put(s, 10, 0);
    give(s, 0, { brick: 1, lumber: 1 });
    s.players[0]!.pieces.roads = 13;
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hud />);
    const road = fab("Build road")!;
    expect(road.disabled).toBe(false);
    expect(road.className).toContain("rounded-full");
    expect(road.querySelector("svg")).not.toBeNull();
    expect(road.closest('[data-slot="card"]')).toBeNull();
    expect(road.parentElement?.querySelector("[data-fab-badge]")?.textContent).toBe("13");
    act(() => {
      road.parentElement!.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }),
      );
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const tip = document.querySelector("[data-cost-tip]");
    expect(tip?.textContent).toContain("Build road");
    expect(
      [...(tip?.querySelectorAll<HTMLElement>("[data-cost] [data-card]") ?? [])].map(
        (c) => c.dataset.card,
      ),
    ).toEqual(["brick", "lumber"]);
  });

  it("No turn bar or build panel in any phase, and the dice tray is the only roll control", () => {
    const states = [
      createGame({ seed: 1, playerCount: 4, mode: "beginner" }),
      playState({ rolled: false }),
      playState(),
      playState({ seat: 1 }),
    ];
    seatRoom(0);
    for (const s of states) {
      showGame(s, 0);
      m = mount(<Hud />);
      // The event log is the only boxed card left in the HUD.
      const cards = [...document.querySelectorAll<HTMLElement>('[data-slot="card"]')];
      expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual(cards.map(() => "Game log"));
      expect(document.querySelector('[aria-label="Turn"], [aria-label="Build"]')).toBeNull();
      const rolls = [...document.querySelectorAll("button")].filter((b) =>
        (b.getAttribute("aria-label") ?? b.textContent ?? "").startsWith("Roll"),
      );
      expect(rolls.length).toBeLessThanOrEqual(1);
      for (const r of rolls) expect(r.dataset.testid).toBe("dice");
      m.unmount();
    }
    m = mount(<div />);
  });

  it("mounts the hand, the status pill and the button cluster", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<Hud />);
    expect(document.querySelector('[role="group"][aria-label="Your hand"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="status-pill"]')).not.toBeNull();
    expect(
      document.querySelector('[data-testid="fab-cluster"] [aria-label="Turn actions"]'),
    ).not.toBeNull();
  });
});

describe("Own hand at the edge", () => {
  const hand = () =>
    m.container.querySelector<HTMLElement>('[role="group"][aria-label="Your hand"]')!;

  it("No development cards: only resource cards, no panel or empty text", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<Hand />);
    expect(hand().querySelectorAll("li")).toHaveLength(5);
    expect(hand().querySelectorAll("li[data-resource]")).toHaveLength(5);
    expect(m.container.textContent).not.toMatch(/development card/i);
    expect(m.container.querySelector('[data-slot="card"]')).toBeNull();
  });

  it("resource cards are focusable, named like 'Brick, 3', and half below the edge", () => {
    const s = playState();
    give(s, 0, { brick: 3 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hand />);
    const slot = hand().querySelector<HTMLElement>('li[data-resource="brick"]')!;
    const card = slot.querySelector<HTMLElement>("[data-card]")!;
    expect(card.tabIndex).toBe(0);
    expect(card.textContent).toContain("Brick, 3");
    expect(card.dataset.layout).toBe("peek");
    expect(slot.className).toContain("translate-y-1/2");
    expect(slot.className).toContain("hover:translate-y-0");
    expect(slot.className).toContain("focus-within:translate-y-0");
    expect(slot.className).toContain("motion-reduce:transition-none");
    // One soft shadow element behind the row instead of a panel.
    expect(hand().querySelectorAll("[data-hand-shadow]")).toHaveLength(1);
  });

  it("First development card bought: it appears after the resource cards, same peek layout", () => {
    const s = playState();
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hand />);
    expect(hand().querySelector("li[data-card]")).toBeNull();
    s.players[0]!.devCards = ["monopoly"];
    s.players[0]!.boughtThisTurn = ["monopoly"];
    showGame(s, 0);
    const items = [...hand().querySelectorAll<HTMLElement>("li")];
    expect(items).toHaveLength(6);
    expect(items.slice(0, 5).every((li) => li.dataset.resource)).toBe(true);
    const last = items[5]!;
    expect(last.dataset.card).toBe("monopoly");
    expect(last.hasAttribute("data-dev-start")).toBe(true);
    expect(last.className).toContain("translate-y-1/2");
    expect(last.querySelector<HTMLElement>("[data-card]")?.dataset.layout).toBe("peek");
    expect(
      hand().style.getPropertyValue("--n") ||
        hand().querySelector("ul")!.style.getPropertyValue("--n"),
    ).toBe("6");
  });

  it("Card bought this turn: the Knight is shown disabled, playable from next turn", () => {
    const s = playState();
    s.players[0]!.devCards = ["knight"];
    s.players[0]!.boughtThisTurn = ["knight"];
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hand />);
    const btn = hand().querySelector<HTMLButtonElement>('button[data-card="knight"]')!;
    expect(btn.disabled).toBe(true);
    expect(describedBy(btn)).toMatch(/playable from your next turn/);
  });

  it("playable development cards rise above the your-turn overlay while it is open", () => {
    const s = playState({ rolled: false });
    s.players[0]!.devCards = ["knight", "monopoly"];
    s.players[0]!.boughtThisTurn = ["monopoly"];
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hand />);
    const slot = (card: string) => hand().querySelector<HTMLElement>(`li[data-card="${card}"]`)!;
    expect(slot("knight").className).not.toContain("z-40");
    act(() => setTurnFocus("open"));
    expect(slot("knight").className).toContain("z-40");
    expect(slot("monopoly").className).not.toContain("z-40");
    expect(hand().querySelector('li[data-resource="brick"]')!.className).not.toContain("z-40");
  });
});

describe("Fab", () => {
  it("has an accessible name, a badge, and a stepped ring with no transition", () => {
    m = mount(
      <TooltipProvider>
        <Fab
          icon={Route}
          label="Build road"
          badge={7}
          ring={{ fraction: 0.5, warning: false, text: "45 seconds left" }}
        />
      </TooltipProvider>,
    );
    const btn = fab("Build road", m.container)!;
    expect(btn).not.toBeNull();
    expect(m.container.querySelector("[data-fab-badge]")?.textContent).toBe("7");
    expect(m.container.querySelector("[data-fab-badge]")?.getAttribute("aria-hidden")).toBe("true");
    const ring = m.container.querySelector<SVGCircleElement>("[data-fab-ring]")!;
    expect(Number(ring.getAttribute("stroke-dashoffset"))).toBeCloseTo(RING_CIRCUMFERENCE / 2);
    expect(Number(ring.getAttribute("stroke-dasharray"))).toBeCloseTo(RING_CIRCUMFERENCE);
    expect(ring.getAttribute("style") ?? "").not.toMatch(/transition|animation/);
    expect(ring.getAttribute("class") ?? "").not.toMatch(/transition|animate/);
    expect(ring.closest("svg")?.getAttribute("class") ?? "").not.toMatch(/transition|animate/);
    expect(describedBy(btn)).toBe("45 seconds left");
  });

  it("has no ring without a countdown", () => {
    m = mount(
      <TooltipProvider>
        <Fab icon={Route} label="Build road" />
      </TooltipProvider>,
    );
    expect(m.container.querySelector("[data-fab-ring]")).toBeNull();
    expect(fab("Build road", m.container)?.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("GameCard layouts", () => {
  it("peek puts the name strip at the top; default keeps it at the bottom", () => {
    m = mount(
      <>
        <GameCard dev="knight" count={2} layout="peek" />
        <GameCard dev="knight" count={2} />
      </>,
    );
    const [peek, normal] = [...m.container.querySelectorAll<HTMLElement>("[data-card]")];
    expect(peek?.dataset.layout).toBe("peek");
    expect(normal?.dataset.layout).toBe("default");
    const name = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-card-name]")!;
    expect(name(peek!).className).toContain("top-0");
    expect(name(peek!).className).not.toContain("bottom-0");
    expect(name(normal!).className).toContain("bottom-0");
    // Icon in the upper half for peek; centered by default.
    const art = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-card-art]")!;
    expect(art(peek!).className).toContain("items-start");
    expect(art(normal!).className).toContain("items-center");
    expect(art(peek!).querySelector("[data-card-icon]")).not.toBeNull();
    // Badge top right in both.
    for (const c of [peek!, normal!]) {
      expect(c.querySelector('[data-slot="badge"]')?.className).toContain("-right-1.5");
    }
  });

  it("dialogs still use the default layout", () => {
    const s = playState();
    give(s, 0, { brick: 5, ore: 4 });
    s.phase = { kind: "discard", owed: [4, 0, 0, 0] };
    seatRoom(0);
    showGame(s, 0);
    m = mount(<DiscardDialog />);
    const cards = [...document.querySelectorAll<HTMLElement>('[role="dialog"] [data-card]')];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.dataset.layout === "default")).toBe(true);
  });
});

describe("Turn countdown display", () => {
  const ring = () => document.querySelector<SVGCircleElement>("[data-fab-ring]");

  it("Countdown on End turn: half-full ring and '45 seconds left'", () => {
    seatRoom(0);
    showGame(playState(), 0);
    setTimer("action", 45_000, [0]);
    m = mount(<ActionButtons />);
    expect(Number(ring()?.getAttribute("stroke-dashoffset"))).toBeCloseTo(RING_CIRCUMFERENCE / 2);
    expect(describedBy(fab("End turn"))).toBe("45 seconds left");
    expect(ring()?.closest("svg")?.hasAttribute("data-warning")).toBe(false);
  });

  it("no End turn ring before the roll (the dice carry the roll countdown)", () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0);
    setTimer("roll", 20_000, [0], 30_000);
    m = mount(<ActionButtons />);
    expect(ring()).toBeNull();
  });

  it("Waiting on an opponent: seat 3's panel shows 20 s to other viewers", () => {
    const s = playState();
    s.phase = { kind: "discard", owed: [0, 0, 0, 4] };
    give(s, 3, { brick: 8 });
    seatRoom(0);
    showGame(s, 0);
    setTimer("action", 20_000, [3]);
    m = mount(<PlayerPanels />);
    const panels = m.container.querySelectorAll('[data-testid="player-panel"]');
    expect(panels[3]?.querySelector('[data-testid="countdown"]')?.textContent).toContain("20 s");
    expect(panels[3]?.textContent).toContain("20 seconds left");
    for (const i of [0, 1, 2]) {
      expect(panels[i]?.querySelector('[data-testid="countdown"]')).toBeNull();
    }
  });

  it("the viewer's own panel never shows the countdown", () => {
    seatRoom(3);
    const s = playState();
    s.phase = { kind: "discard", owed: [0, 0, 0, 4] };
    give(s, 3, { brick: 8 });
    showGame(s, 3);
    setTimer("action", 20_000, [3]);
    m = mount(<PlayerPanels />);
    expect(m.container.querySelector('[data-testid="countdown"]')).toBeNull();
  });

  it("the discard dialog shows the viewer's own countdown", () => {
    const s = playState();
    give(s, 0, { brick: 5, ore: 4 });
    s.phase = { kind: "discard", owed: [4, 0, 0, 0] };
    seatRoom(0);
    showGame(s, 0);
    setTimer("action", 33_000, [0]);
    m = mount(<DiscardDialog />);
    expect(
      document.querySelector('[role="dialog"] [data-testid="countdown"]')?.textContent,
    ).toContain("33 seconds left");
  });

  it("the robber and Road Building prompts show the viewer's own countdown", () => {
    const s = playState();
    s.phase = { kind: "moveRobber", source: "seven" };
    seatRoom(0);
    showGame(s, 0);
    setTimer("action", 25_000, [0]);
    m = mount(<StatusPill />);
    const pill = () => m.container.querySelector('[data-testid="status-pill"]');
    expect(pill()?.textContent).toContain("Move the robber");
    expect(pill()?.querySelector('[data-testid="countdown"]')?.textContent).toContain("25 s");
    s.phase = { kind: "roadBuilding", remaining: 2 };
    showGame(s, 0);
    expect(pill()?.textContent).toContain("Place a free road");
    expect(pill()?.querySelector('[data-testid="countdown"]')?.textContent).toContain("25 s");
    // Another seat's robber move is on their panel, not in the viewer's pill.
    seatRoom(1);
    showGame(s, 1);
    expect(pill()?.querySelector('[data-testid="countdown"]')).toBeNull();
  });

  it("Last seconds: warning color and '10 seconds left' announced once", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
    });
    seatRoom(0);
    showGame(playState(), 0);
    setTimer("action", 11_000, [0]);
    m = mount(
      <>
        <ActionButtons />
        <CountdownAnnouncer />
      </>,
    );
    const announce = () =>
      m.container.querySelector('[data-testid="countdown-announce"]')?.textContent;
    const warning = () => ring()?.closest("svg")?.hasAttribute("data-warning");
    expect(warning()).toBe(false);
    expect(announce()).toBe("");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(describedBy(fab("End turn"))).toBe("10 seconds left");
    expect(warning()).toBe(true);
    expect(announce()).toBe("10 seconds left");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(describedBy(fab("End turn"))).toBe("7 seconds left");
    // Still the single announcement: the live region did not change.
    expect(announce()).toBe("10 seconds left");
    expect(
      m.container.querySelector('[data-testid="countdown-announce"]')?.getAttribute("aria-live"),
    ).toBe("polite");
  });

  it("a countdown that starts in the last seconds is not announced", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
    });
    seatRoom(0);
    showGame(playState(), 0);
    setTimer("action", 7_000, [0]);
    m = mount(<CountdownAnnouncer />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(m.container.textContent).toBe("");
  });

  it("other players' countdowns are not announced to the viewer", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
    });
    seatRoom(0);
    showGame(playState({ seat: 1 }), 0);
    setTimer("action", 11_000, [1]);
    m = mount(<CountdownAnnouncer />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(m.container.textContent).toBe("");
  });

  it("Timer off: no countdown anywhere in the HUD", () => {
    seatRoom(0);
    const s = playState();
    give(s, 0, { brick: 5, ore: 4 });
    s.phase = { kind: "discard", owed: [4, 0, 0, 4] };
    give(s, 3, { brick: 8 });
    showGame(s, 0);
    m = mount(<Hud />);
    expect(useGameStore.getState().timer).toBeNull();
    expect(document.querySelector('[data-testid="countdown"]')).toBeNull();
    expect(document.querySelector("[data-fab-ring]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/seconds? left/);
    m.unmount();
    showGame(playState(), 0);
    m = mount(<Hud />);
    expect(document.querySelector("[data-fab-ring]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/seconds? left/);
  });

  it("a click on End turn still works with the ring", () => {
    const calls = recordSession();
    seatRoom(0);
    showGame(playState(), 0);
    setTimer("action", 45_000, [0]);
    m = mount(<ActionButtons />);
    click(fab("End turn"));
    expect(calls.filter((c) => c.fn === "act").map((c) => c.args[0])).toEqual([
      { type: "endTurn" },
    ]);
  });
});
