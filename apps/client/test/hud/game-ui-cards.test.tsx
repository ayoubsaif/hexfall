// Hand, development cards and build costs (moved from game-ui.test.tsx; build controls are the
// floating buttons since floating-hud-turn-timer).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { StatusPill } from "../../src/hud/StatusPill.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { DevCards, groupCards } from "../../src/hud/DevCards.tsx";
import { Hand } from "../../src/hud/Hand.tsx";
import { useUiStore } from "../../src/store/ui.ts";
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

/** A floating button by accessible name. */
const fab = (root: ParentNode, name: string) =>
  root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
/** A button's accessible description text. */
const describedBy = (btn: HTMLElement | null) =>
  document.getElementById(btn?.getAttribute("aria-describedby") ?? "")?.textContent;
/**
 * Opens a floating button's tooltip by hovering its wrapper (disabled buttons show it too) and
 * returns its content element. Needs fake timers (the tooltip opens after a delay).
 */
function tooltipOf(btn: HTMLButtonElement): HTMLElement | null {
  const trigger = btn.parentElement!;
  act(() => {
    trigger.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }));
  });
  act(() => {
    vi.advanceTimersByTime(500);
  });
  return document.querySelector<HTMLElement>("[data-cost-tip]");
}

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

describe("Hand and DevCards", () => {
  it("shows own resources; pieces left are on the build buttons", () => {
    const s = playState();
    give(s, 0, { grain: 2 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(
      <>
        <Hand />
        <ActionButtons />
      </>,
    );
    expect(m.container.querySelector('[data-resource="grain"] .sr-only')?.textContent).toBe(
      "Grain, 2",
    );
    const road = fab(m.container, "Build road")!;
    expect(road.parentElement?.querySelector("[data-fab-badge]")?.textContent).toBe("15");
    expect(describedBy(road)).toContain("15 roads left");
  });

  it("marks a card bought this turn and only offers legal plays", () => {
    const s = playState();
    s.players[0]!.devCards = ["knight", "monopoly"];
    s.players[0]!.boughtThisTurn = ["knight"];
    seatRoom(0);
    showGame(s, 0);
    m = mount(<DevCards />);
    const knight = m.container.querySelector('[data-card="knight"]')!;
    expect(knight.textContent).toMatch(/playable from your next turn/);
    expect(knight.querySelector("button")!.disabled).toBe(true);
    const mono = m.container.querySelector('[data-card="monopoly"] button')!;
    expect((mono as HTMLButtonElement).disabled).toBe(false);
    click(mono);
    expect(useUiStore.getState().dialog).toBe("monopoly");
  });

  it("no plays after a development card was played this turn", () => {
    const s = playState();
    s.players[0]!.devCards = ["knight", "roadBuilding"];
    s.turn.devPlayed = true;
    seatRoom(0);
    showGame(s, 0);
    m = mount(<DevCards />);
    const buttons = [...m.container.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it("Knight sends playKnight; reveal shows only when legal", () => {
    const s = playState();
    s.players[0]!.devCards = ["knight", "victoryPoint"];
    seatRoom(0);
    showGame(s, 0);
    m = mount(<DevCards />);
    expect(byText(m.container, "button", "Reveal to win")).toBeUndefined();
    click(m.container.querySelector('[data-card="knight"] button'));
    expect(actions(calls)).toEqual([{ type: "playKnight" }]);
    expect(groupCards(["knight", "knight"], ["knight"])).toEqual([
      { card: "knight", count: 2, fresh: 1 },
    ]);
  });
});

describe("build buttons", () => {
  it("shows costs and starts a pick with Cancel in the status pill", () => {
    const s = playState();
    put(s, 10, 0);
    give(s, 0, { brick: 1, lumber: 1 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(
      <>
        <StatusPill />
        <ActionButtons />
      </>,
    );
    const roadBtn = fab(m.container, "Build road")!;
    expect(describedBy(roadBtn)).toContain("1 Brick, 1 Lumber");
    expect(fab(m.container, "Build city")!.disabled).toBe(true);
    click(roadBtn);
    expect(useUiStore.getState().build).toBe("road");
    expect(roadBtn.getAttribute("aria-pressed")).toBe("true");
    expect(m.container.textContent).toContain("Pick a spot on the board.");
    click(byText(m.container, "button", "Cancel"));
    expect(useUiStore.getState().build).toBeNull();
    expect(m.container.textContent).not.toContain("Pick a spot on the board");
  });

  it("drops a chosen build that has no legal target any more", () => {
    const s = playState();
    put(s, 10, 0);
    give(s, 0, { brick: 1, lumber: 1 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(<ActionButtons />);
    click(fab(m.container, "Build road"));
    s.players[0]!.resources.brick = 0;
    showGame(s, 0);
    expect(useUiStore.getState().build).toBeNull();
  });

  it("buy card and bank trade follow legal", () => {
    const s = playState();
    give(s, 0, { ore: 4, grain: 1, wool: 1 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(<ActionButtons />);
    click(fab(m.container, "Buy development card"));
    expect(actions(calls)).toEqual([{ type: "buyDevCard" }]);
    click(fab(m.container, "Trade with bank"));
    expect(useUiStore.getState().dialog).toBe("maritime");
  });
});

describe("cards (specs/hud-presentation)", () => {
  /** Accessible card text per hand slot, plus dimmed state. */
  function slots(root: ParentNode) {
    return [...root.querySelectorAll<HTMLElement>("li[data-resource]")].map((li) => ({
      resource: li.dataset.resource,
      label: li.querySelector(".sr-only")?.textContent,
      dimmed: li.querySelector("[data-card]")?.getAttribute("data-dimmed") === "true",
      badge: li.querySelector('[data-slot="badge"]')?.textContent ?? null,
    }));
  }

  it("Hand shows cards: stacks with counts, dimmed empties", () => {
    const s = playState();
    give(s, 0, { brick: 3, lumber: 1, ore: 2 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hand />);
    expect(slots(m.container)).toEqual([
      { resource: "brick", label: "Brick, 3", dimmed: false, badge: "3" },
      { resource: "grain", label: "Grain, 0", dimmed: true, badge: null },
      { resource: "lumber", label: "Lumber, 1", dimmed: false, badge: null },
      { resource: "ore", label: "Ore, 2", dimmed: false, badge: "2" },
      { resource: "wool", label: "Wool, 0", dimmed: true, badge: null },
    ]);
    // Stacks draw full cards behind the face card (specs/hand-cards "Stack at rest").
    const ghosts = (r: string) => [
      ...m.container.querySelectorAll<HTMLElement>(`li[data-resource="${r}"] [data-card-ghost]`),
    ];
    expect(ghosts("brick")).toHaveLength(2);
    expect(ghosts("ore")).toHaveLength(1);
    expect(ghosts("lumber")).toHaveLength(0);
  });

  it("Hand cards use the classic face with a corner icon (specs/hand-cards)", () => {
    const s = playState();
    give(s, 0, { wool: 1 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hand />);
    const wool = m.container.querySelector<HTMLElement>('li[data-resource="wool"] [data-card]')!;
    expect(wool.className).toContain("bg-leather");
    const art = wool.querySelector<HTMLElement>("[data-card-art]")!;
    expect(art.style.backgroundImage).toContain("parchment.jpg");
    expect(art.style.boxShadow).toContain("var(--frame)");
    expect(art.querySelector("img[data-corner-icon]")?.getAttribute("src")).toContain("wool.webp");
  });

  it("stacks: two visible at rest, all fan by 10 % on hover, drawn in full and hidden from readers", () => {
    const s = playState();
    give(s, 0, { brick: 5, wool: 4, ore: 2 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hand />);
    const slot = (r: string) => m.container.querySelector<HTMLElement>(`li[data-resource="${r}"]`)!;
    const ghosts = (r: string) => [...slot(r).querySelectorAll<HTMLElement>("[data-card-ghost]")];
    expect(ghosts("ore").filter((g) => g.dataset.rest)).toHaveLength(1);
    const brick = ghosts("brick");
    expect(brick).toHaveLength(4);
    expect(brick.filter((g) => g.dataset.rest)).toHaveLength(2);
    expect(brick[0]!.className).toContain("translate-y-[calc(var(--k)*-6%)]");
    expect(brick[3]!.className).toContain("opacity-0");
    for (const g of brick) {
      expect(g.className).toContain("group-hover/slot:translate-y-[calc(var(--k)*-10%)]");
      expect(g.className).toContain("group-hover/slot:opacity-100");
      expect(g.getAttribute("aria-hidden")).toBe("true");
      // Full card details, not just a background.
      expect(g.querySelector("img[data-corner-icon]")).not.toBeNull();
      expect(g.querySelectorAll("img")).toHaveLength(2);
    }
    expect(brick.map((g) => g.style.getPropertyValue("--k"))).toEqual(["1", "2", "3", "4"]);
    // The nearest card is drawn on top, so every card behind keeps its top band visible.
    expect(brick.map((g) => g.style.zIndex)).toEqual(["-1", "-2", "-3", "-4"]);
    expect(slot("wool").querySelector(".sr-only")?.textContent).toBe("Wool, 4");
  });

  it("Knight bought this turn is disabled and says when it becomes playable", () => {
    const s = playState();
    s.players[0]!.devCards = ["knight"];
    s.players[0]!.boughtThisTurn = ["knight"];
    seatRoom(0);
    showGame(s, 0);
    m = mount(<DevCards />);
    const btn = m.container.querySelector<HTMLButtonElement>('button[data-card="knight"]')!;
    expect(btn.disabled).toBe(true);
    const descId = btn.getAttribute("aria-describedby")!;
    expect(document.getElementById(descId)?.textContent).toMatch(/from your next turn/);
  });

  it("Victory Point cards are shown but never played", () => {
    const s = playState();
    s.players[0]!.devCards = ["victoryPoint", "victoryPoint"];
    seatRoom(0);
    showGame(s, 0);
    m = mount(<DevCards />);
    const vp = m.container.querySelector('[data-card="victoryPoint"]');
    expect(vp?.textContent).toContain("Victory Point, 2");
    expect(m.container.querySelector("button")).toBeNull();
  });

  it("Build-cost hint uses cards: a settlement shows one brick, lumber, wool and grain", () => {
    vi.useFakeTimers();
    const s = playState();
    seatRoom(0);
    showGame(s, 0);
    m = mount(<ActionButtons />);
    const btn = fab(m.container, "Build settlement")!;
    // The cost is text for assistive tech, and cards in the tooltip.
    expect(describedBy(btn)).toContain("1 Brick, 1 Grain, 1 Lumber, 1 Wool");
    const tip = tooltipOf(btn)!;
    const cards = [...tip.querySelectorAll<HTMLElement>("[data-cost] [data-card]")].map(
      (c) => c.dataset.card,
    );
    expect(cards).toEqual(["brick", "grain", "lumber", "wool"]);
    expect(tip.querySelector("[data-cost]")?.getAttribute("aria-hidden")).toBe("true");
    m.unmount();
    m = mount(<ActionButtons />);
    const city = tooltipOf(fab(m.container, "Build city")!)!;
    expect(
      [...city.querySelectorAll<HTMLElement>("[data-cost] [data-card]")].map((c) => c.dataset.card),
    ).toEqual(["grain", "grain", "ore", "ore", "ore"]);
  });
});
