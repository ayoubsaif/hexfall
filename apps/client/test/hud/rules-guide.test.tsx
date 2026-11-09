// Rules guide dialog and info button (openspec tutorial-mode-and-rules-guide, specs/rules-guide).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hud } from "../../src/hud/Hud.tsx";
import { RulesGuide } from "../../src/hud/RulesGuide.tsx";
import { en, es } from "../../src/i18n/locales/index.ts";
import {
  RULES_SECTIONS,
  closeRulesGuide,
  openRulesGuide,
  useRulesGuideStore,
} from "../../src/store/rulesGuide.ts";
import { useGameStore } from "../../src/store/game.ts";
import { playState } from "../game/fixtures.ts";
import { click, mount, resetAll, seatRoom, showGame, type Mounted } from "./helpers.tsx";

let m: Mounted | null = null;

const byTestId = <E extends Element = HTMLElement>(id: string) =>
  document.querySelector<E>(`[data-testid="${id}"]`);
const section = () =>
  document.querySelector(
    '[data-testid^="rules-section-"]:not([data-testid="rules-section-title"])',
  );

beforeEach(() => {
  resetAll();
  useRulesGuideStore.setState({ open: false, section: "goal" });
});

afterEach(() => {
  act(() => closeRulesGuide());
  m?.unmount();
  m = null;
  resetAll();
});

describe("Rules guide", () => {
  it("opens at Goal and components with Previous disabled and Next enabled", () => {
    m = mount(<RulesGuide />);
    act(() => openRulesGuide());
    expect(byTestId("rules-guide")).not.toBeNull();
    expect(section()?.getAttribute("data-testid")).toBe("rules-section-goal");
    expect(section()?.getAttribute("aria-label")).toBe("Goal and components");
    expect(byTestId<HTMLButtonElement>("rules-previous")?.disabled).toBe(true);
    expect(byTestId<HTMLButtonElement>("rules-next")?.disabled).toBe(false);
    const img = byTestId<HTMLImageElement>("rules-image");
    expect(img?.getAttribute("src")).toBe("/rules/goal.webp");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.alt).not.toBe("");
  });

  it("opens at a requested section", () => {
    m = mount(<RulesGuide />);
    act(() => openRulesGuide("robber"));
    expect(section()?.getAttribute("data-testid")).toBe("rules-section-robber");
    expect(byTestId("rules-image")?.getAttribute("src")).toBe("/rules/robber.webp");
  });

  it("every section shows a strip of game pieces next to its text", () => {
    m = mount(<RulesGuide />);
    for (const s of RULES_SECTIONS) {
      act(() => openRulesGuide(s));
      const strips = section()?.querySelectorAll('[data-testid="rules-visual"]') ?? [];
      expect(strips.length, s).toBeGreaterThan(0);
    }
    act(() => openRulesGuide("building"));
    // One cost row per buildable item: road, settlement, city, development card.
    expect(section()?.querySelectorAll("[data-cost]").length).toBe(4);
    act(() => openRulesGuide("devCards"));
    expect(section()?.textContent).toContain("×14");
  });

  it("moves with Next and Previous, and Next is disabled on the last section", () => {
    m = mount(<RulesGuide />);
    act(() => openRulesGuide());
    click(byTestId("rules-next"));
    expect(useRulesGuideStore.getState().section).toBe("setup");
    click(byTestId("rules-previous"));
    expect(useRulesGuideStore.getState().section).toBe("goal");
    for (let i = 1; i < RULES_SECTIONS.length; i++) click(byTestId("rules-next"));
    expect(section()?.getAttribute("data-testid")).toBe("rules-section-winning");
    expect(byTestId<HTMLButtonElement>("rules-next")?.disabled).toBe(true);
    expect(byTestId<HTMLButtonElement>("rules-previous")?.disabled).toBe(false);
  });

  it("jumps to a section from the section list", () => {
    m = mount(<RulesGuide />);
    act(() => openRulesGuide());
    click(byTestId("rules-nav-trading"));
    expect(section()?.getAttribute("data-testid")).toBe("rules-section-trading");
  });

  it("keeps the text and the image box when an illustration fails to load", () => {
    m = mount(<RulesGuide />);
    act(() => openRulesGuide("production"));
    const img = byTestId<HTMLImageElement>("rules-image")!;
    act(() => {
      img.dispatchEvent(new Event("error"));
    });
    expect(byTestId<HTMLImageElement>("rules-image")?.hidden).toBe(true);
    expect(byTestId("rules-image")?.parentElement?.className).toContain("aspect-video");
    expect(section()?.textContent).toContain("number token");
  });

  it("robber text: more than 7 cards discard half rounded down, a different hex, 1 random card", () => {
    m = mount(<RulesGuide />);
    act(() => openRulesGuide("robber"));
    const text = section()?.textContent ?? "";
    expect(text).toContain("more than 7");
    expect(text).toContain("discards half");
    expect(text).toContain("rounded down");
    expect(text).toContain("different hex");
    expect(text).toContain("1 random resource card");
  });

  it("closes from the close button", () => {
    m = mount(<RulesGuide />);
    act(() => openRulesGuide());
    click(byTestId("rules-close"));
    expect(useRulesGuideStore.getState().open).toBe(false);
    expect(byTestId("rules-guide")).toBeNull();
  });

  it("every section has a title, alt text, intro and points in both languages", () => {
    for (const s of RULES_SECTIONS) {
      const e = en.rules.section[s];
      const sp = es.rules.section[s];
      expect(e.title && e.alt && e.intro).toBeTruthy();
      expect(sp.title && sp.alt && sp.intro).toBeTruthy();
      expect(Object.keys(sp.points)).toEqual(Object.keys(e.points));
      expect(Object.keys(e.points).length).toBeGreaterThan(2);
    }
  });
});

describe("How to play button", () => {
  it("is on the start screen and opens the guide", () => {
    m = mount(<Hud />);
    const button = m.container.querySelector('[data-testid="rules-button"]');
    expect(button?.getAttribute("aria-label")).toBe("How to play");
    click(button);
    expect(useRulesGuideStore.getState()).toMatchObject({ open: true, section: "goal" });
    expect(byTestId("rules-guide")).not.toBeNull();
  });

  it("opens over a game without changing the game state", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<Hud />);
    const before = useGameStore.getState();
    click(m.container.querySelector('[data-testid="rules-button"]'));
    expect(byTestId("rules-guide")).not.toBeNull();
    expect(useGameStore.getState()).toBe(before);
  });
});
