// specs/tutorial-mode "Phase hint", "Turning tutorial off and on", "Rule helpers on game controls".
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HudRootContext } from "@/components/ui/hud-root.ts";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { Hud } from "../../src/hud/Hud.tsx";
import { PhaseHint, useHintCollapsed } from "../../src/hud/tutorial/PhaseHint.tsx";
import { i18n } from "../../src/i18n/index.ts";
import { useRulesGuideStore } from "../../src/store/rulesGuide.ts";
import { setTutorialEnabled, useTutorial } from "../../src/store/tutorial.ts";
import { playState, setupState } from "../game/fixtures.ts";
import { click, mount, resetAll, seatRoom, showGame, type Mounted } from "./helpers.tsx";

let m: Mounted | null = null;
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

beforeEach(() => {
  resetAll();
  act(() => {
    setTutorialEnabled(true);
    useHintCollapsed.setState({ collapsed: false });
    useRulesGuideStore.setState({ open: false, section: "goal" });
  });
});

afterEach(async () => {
  m?.unmount();
  m = null;
  resetAll();
  act(() => setTutorialEnabled(true));
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("PhaseHint", () => {
  it("text follows the phase", () => {
    seatRoom(0);
    showGame(setupState(), 0);
    m = mount(<PhaseHint />);
    expect(q("phase-hint")?.dataset["hint"]).toBe("setupSettlement1");
    expect(q("phase-hint-text")?.textContent).toMatch(/first settlement.*Distance Rule/);
    showGame(playState({ rolled: false }), 0);
    expect(q("phase-hint")?.dataset["hint"]).toBe("rollFirst");
    expect(q("phase-hint-text")?.textContent).toMatch(/roll the dice.*Knight/);
    const s = playState();
    s.phase = { kind: "moveRobber", source: "seven" };
    showGame(s, 0);
    expect(q("phase-hint-text")?.textContent).toMatch(/different hex.*steal/);
    s.phase = { kind: "discard", owed: [4, 0, 0, 0] };
    showGame(s, 0);
    expect(q("phase-hint-text")?.textContent).toMatch(/discard 4 cards/);
  });

  it("Learn more opens the rules guide at the hint's section", () => {
    seatRoom(0);
    showGame(setupState(), 0);
    m = mount(<PhaseHint />);
    click(q("phase-hint-learn"));
    expect(useRulesGuideStore.getState()).toMatchObject({ open: true, section: "setup" });
  });

  it("collapses to a chip and back", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<PhaseHint />);
    click(q("phase-hint-collapse"));
    expect(q("phase-hint")).toBeNull();
    click(q("phase-hint-chip"));
    expect(q("phase-hint")).not.toBeNull();
  });

  it("Turn off hides the hint and the helpers and writes the cookie", () => {
    seatRoom(0);
    m = mount(<Hud />);
    showGame(playState(), 0);
    expect(q("phase-hint")).not.toBeNull();
    click(q("phase-hint-off"));
    expect(useTutorial.getState().enabled).toBe(false);
    expect(document.cookie).toContain("hexfall_tutorial=off");
    expect(q("phase-hint")).toBeNull();
    expect(q("phase-hint-chip")).toBeNull();
  });

  it("is shown in Spanish", async () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0);
    m = mount(<PhaseHint />);
    await act(async () => {
      await i18n.changeLanguage("es");
    });
    expect(q("phase-hint-text")?.textContent).toMatch(/tira los dados.*Caballero/);
  });
});

describe("rule helpers on the action buttons", () => {
  function renderButtons() {
    const hud = document.createElement("div");
    document.body.append(hud);
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(
      <HudRootContext value={hud}>
        <TooltipProvider>
          <ActionButtons />
        </TooltipProvider>
      </HudRootContext>,
    );
    return hud;
  }

  it("tutorial on: hovering a disabled build opens the card with cost, Distance Rule and why", () => {
    vi.useFakeTimers();
    renderButtons();
    const trigger = document
      .querySelector('button[aria-label="Build settlement"]')!
      .closest<HTMLElement>("[data-fab]")!;
    act(() => {
      for (const type of ["pointerenter", "pointerover"])
        trigger.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "mouse" }));
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    vi.useRealTimers();
    const card = document.querySelector('[data-testid="tutorial-help"]');
    expect(card?.getAttribute("data-topic")).toBe("settlement");
    expect(card?.textContent).toMatch(/Distance Rule/);
    expect(card?.querySelectorAll("[data-tutorial-cost] [data-cost] > *").length).toBe(4);
    expect(card?.querySelector("[data-tutorial-blocker]")?.textContent).toMatch(/You need/);
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("tutorial off: the plain tooltip only, no rule helper", () => {
    act(() => setTutorialEnabled(false));
    vi.useFakeTimers();
    renderButtons();
    const trigger = document
      .querySelector('button[aria-label="Build settlement"]')!
      .closest<HTMLElement>("[data-fab]")!;
    act(() => {
      for (const type of ["pointerenter", "pointerover", "pointermove"])
        trigger.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "mouse" }));
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    vi.useRealTimers();
    expect(document.querySelector('[data-testid="tutorial-help"]')).toBeNull();
    expect(document.querySelector('[data-testid="hover-card"]')).toBeNull();
  });
});
