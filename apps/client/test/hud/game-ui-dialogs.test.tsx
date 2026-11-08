// Dialogs and maritime trade (moved from game-ui.test.tsx).
import { TOPOLOGY } from "@hexfall/engine/geometry";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DiscardDialog,
  MonopolyDialog,
  VictimDialog,
  YearOfPlentyDialog,
} from "../../src/hud/Dialogs.tsx";
import { MaritimePanel } from "../../src/hud/MaritimePanel.tsx";
import { openDialog, setVictimHex, useUiStore } from "../../src/store/ui.ts";
import { give, playState, put, seen } from "../game/fixtures.ts";
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
  calls = recordSession();
});
afterEach(() => {
  m?.unmount();
  resetAll();
  vi.useRealTimers();
});

/** Dialogs portal out of the mount container (to document.body without a Hud). */
const doc = () => document.body;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const titleOf = (el: HTMLElement | null) => {
  const id = el?.getAttribute("aria-labelledby");
  return id ? document.getElementById(id)?.textContent : undefined;
};
const pressEscape = () =>
  act(() => {
    dialog()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

/** Seat 0 owes 4 cards from 5 brick + 4 ore. */
function mountDiscard(): void {
  const s = playState();
  give(s, 0, { brick: 5, ore: 4 });
  s.phase = { kind: "discard", owed: [4, 0, 0, 0] };
  seatRoom(0);
  showGame(s, 0);
  m = mount(<DiscardDialog />);
}

describe("dialogs", () => {
  it("discard: Confirm only with exactly the owed count", () => {
    mountDiscard();
    expect(titleOf(dialog())).toBe("Discard 4 cards");
    const confirm = byText(doc(), "button", "Discard")!;
    const more = (r: string) =>
      document.querySelector(`[data-resource="${r}"] [aria-label^="One more"]`);
    click(more("brick"));
    click(more("brick"));
    click(more("brick"));
    expect(confirm.disabled).toBe(true);
    click(more("ore"));
    expect(confirm.disabled).toBe(false);
    expect((more("ore") as HTMLButtonElement).disabled).toBe(true);
    click(confirm);
    expect(actions(calls)).toEqual([{ type: "discard", cards: { brick: 3, ore: 1 } }]);
    expect(byText(doc(), "button", "Cancel")).toBeUndefined();
  });

  it("discard dialog uses cards (spec: Discard dialog uses cards)", () => {
    mountDiscard();
    const d = dialog()!;
    for (const r of ["brick", "grain", "lumber", "ore", "wool"]) {
      const row = d.querySelector(`[data-resource="${r}"]`)!;
      // A picture card for the resource, with the number to discard next to it.
      expect(row.querySelector(`[data-card="${r}"] [data-card-art]`)).not.toBeNull();
      expect(row.querySelector("[data-stepper-value]")?.textContent).toBe("0");
    }
    click(d.querySelector('[data-resource="ore"] [aria-label^="One more"]'));
    expect(d.querySelector('[data-resource="ore"] [data-stepper-value]')?.textContent).toBe("1");
  });

  it("discard cannot be dismissed with Escape", () => {
    mountDiscard();
    pressEscape();
    expect(dialog()).not.toBeNull();
  });

  it("no discard dialog for a player who owes nothing", () => {
    const s = playState();
    s.phase = { kind: "discard", owed: [0, 4, 0, 0] };
    seatRoom(0);
    showGame(s, 0);
    m = mount(<DiscardDialog />);
    expect(m.container.innerHTML).toBe("");
    expect(dialog()).toBeNull();
  });

  it("Year of Plenty sends the two chosen resources", () => {
    const s = playState();
    s.players[0]!.devCards = ["yearOfPlenty"];
    seatRoom(0);
    showGame(s, 0);
    act(() => openDialog("yearOfPlenty"));
    m = mount(<YearOfPlentyDialog />);
    const take = byText(doc(), "button", "Take cards")!;
    click(document.querySelector('[data-resource="grain"] [aria-label^="One more"]'));
    expect(take.disabled).toBe(true);
    click(document.querySelector('[data-resource="ore"] [aria-label^="One more"]'));
    click(take);
    expect(actions(calls)).toEqual([{ type: "playYearOfPlenty", resources: ["grain", "ore"] }]);
    expect(useUiStore.getState().dialog).toBeNull();
  });

  it("Year of Plenty closes on Escape without playing", () => {
    const s = playState();
    s.players[0]!.devCards = ["yearOfPlenty"];
    seatRoom(0);
    showGame(s, 0);
    act(() => openDialog("yearOfPlenty"));
    m = mount(<YearOfPlentyDialog />);
    pressEscape();
    expect(useUiStore.getState().dialog).toBeNull();
    expect(actions(calls)).toEqual([]);
  });

  it("Year of Plenty is limited by the bank", () => {
    const s = playState();
    s.players[0]!.devCards = ["yearOfPlenty"];
    s.bank = { brick: 0, grain: 0, lumber: 0, ore: 1, wool: 0 };
    seatRoom(0);
    showGame(s, 0);
    act(() => openDialog("yearOfPlenty"));
    m = mount(<YearOfPlentyDialog />);
    expect(dialog()?.textContent).toContain("Take 1 card");
    const grain = document.querySelector<HTMLButtonElement>(
      '[data-resource="grain"] [aria-label^="One more"]',
    )!;
    expect(grain.disabled).toBe(true);
    click(document.querySelector('[data-resource="ore"] [aria-label^="One more"]'));
    click(byText(doc(), "button", "Take cards"));
    expect(actions(calls)).toEqual([{ type: "playYearOfPlenty", resources: ["ore"] }]);
  });

  it("Monopoly sends the named resource from its card", () => {
    const s = playState();
    s.players[0]!.devCards = ["monopoly"];
    seatRoom(0);
    showGame(s, 0);
    act(() => openDialog("monopoly"));
    m = mount(<MonopolyDialog />);
    const wool = document.querySelector<HTMLButtonElement>('button[data-card="wool"]')!;
    expect(wool.textContent).toContain("Wool");
    click(wool);
    expect(actions(calls)).toEqual([{ type: "playMonopoly", resource: "wool" }]);
    expect(useUiStore.getState().dialog).toBeNull();
  });

  it("victim choice lists candidates with hand sizes and sends the choice", () => {
    const s = playState();
    s.phase = { kind: "moveRobber", source: "seven" };
    // A hex with buildings of seats 1 and 3.
    const { legal } = seen(s, 0);
    const hex = legal.moveRobber[0]!.hex;
    const corners = cornersOf(hex);
    put(s, corners[0]!, 1);
    put(s, corners[3]!, 3);
    give(s, 3, { wool: 2 });
    seatRoom(0);
    showGame(s, 0);
    act(() => setVictimHex(hex));
    m = mount(<VictimDialog />);
    const options = [...document.querySelectorAll('[data-testid="victim-option"]')];
    expect(options.map((o) => o.textContent)).toEqual(["Ben0 cards", "Dee2 cards"]);
    click(options[1]);
    expect(actions(calls)).toEqual([{ type: "moveRobber", hex, victim: 3 }]);
    expect(useUiStore.getState().victimHex).toBeNull();
  });

  it("victim choice can be cancelled", () => {
    const s = playState();
    s.phase = { kind: "moveRobber", source: "seven" };
    const hex = seen(s, 0).legal.moveRobber[0]!.hex;
    const corners = cornersOf(hex);
    put(s, corners[0]!, 1);
    put(s, corners[3]!, 2);
    seatRoom(0);
    showGame(s, 0);
    act(() => setVictimHex(hex));
    m = mount(<VictimDialog />);
    click(byText(doc(), "button", "Pick another hex"));
    expect(useUiStore.getState().victimHex).toBeNull();
    expect(actions(calls)).toEqual([]);
  });
});

function cornersOf(hex: number): number[] {
  return TOPOLOGY.vertices.filter((v) => v.hexes.includes(hex)).map((v) => v.id);
}

/** Opens the maritime panel for seat 0 with a settlement on the 2:1 ore harbor. */
function openOreHarborTrade(): void {
  const s = playState();
  const oreSlot = s.board.harbors.findIndex((h) => h === "ore");
  const v = TOPOLOGY.vertices.find((x) => x.harborSlot === oreSlot)!;
  put(s, v.id, 0);
  give(s, 0, { ore: 4, wool: 3 });
  seatRoom(0);
  showGame(s, 0);
  act(() => openDialog("maritime"));
  m = mount(<MaritimePanel />);
}

const choice = (group: "Give" | "Get", r: string) =>
  document.querySelector<HTMLButtonElement>(
    `[role="radiogroup"][aria-label="${group}"] [role="radio"][data-resource="${r}"]`,
  )!;

describe("MaritimePanel", () => {
  it("shows harbor rates and trades within limits", () => {
    openOreHarborTrade();
    expect(choice("Give", "ore").querySelector("[data-rate]")?.textContent).toBe("2:1");
    expect(choice("Give", "wool").disabled).toBe(true);
    click(choice("Give", "ore"));
    expect(choice("Give", "ore").getAttribute("aria-checked")).toBe("true");
    click(choice("Get", "grain"));
    expect(document.querySelector('input[type="number"]')).toBeNull();
    const stepper = document.querySelector<HTMLElement>('[data-testid="maritime-count"]')!;
    const less = stepper.querySelector<HTMLButtonElement>('[aria-label="Get one less"]')!;
    const more = stepper.querySelector<HTMLButtonElement>('[aria-label="Get one more"]')!;
    const value = () => stepper.querySelector("[data-stepper-value]")?.textContent;
    expect(value()).toBe("1");
    expect(less.disabled).toBe(true);
    click(more);
    expect(value()).toBe("2");
    expect(more.disabled).toBe(true);
    click(less);
    expect(value()).toBe("1");
    click(byText(doc(), "button", "Trade"));
    expect(actions(calls)).toEqual([
      { type: "maritimeTrade", give: "ore", get: "grain", count: 1 },
    ]);
    expect(dialog()?.textContent ?? "").not.toMatch(/player/i);
  });

  it("names each card choice with its rate and the bank's stock", () => {
    openOreHarborTrade();
    expect(choice("Give", "ore").getAttribute("aria-label")).toBe("Give Ore, 2:1, you have 4");
    expect(choice("Give", "wool").getAttribute("aria-label")).toBe("Give Wool, 4:1, you have 3");
    expect(choice("Get", "grain").getAttribute("aria-label")).toMatch(/^Get Grain, bank has \d+$/);
    expect(choice("Give", "ore").querySelector('[data-card="ore"] [data-card-art]')).not.toBeNull();
  });
});
