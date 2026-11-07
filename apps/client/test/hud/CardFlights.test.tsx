// Card flights overlay: live updates draw flying cards, snapshots and reduced motion do not.
import { act } from "react";
import type { GameEvent } from "@hexfall/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CardFlights } from "../../src/hud/CardFlights.tsx";
import { useGameStore } from "../../src/store/game.ts";
import { usePrefsStore } from "../../src/store/prefs.ts";
import { playState } from "../game/fixtures.ts";
import { mount, resetAll, seatRoom, showGame, type Mounted } from "./helpers.tsx";

const produced: GameEvent = { type: "produced", seat: 1, resources: { grain: 2 } };
const stole: GameEvent = { type: "stole", thief: 1, victim: 2, resource: null };

describe("CardFlights", () => {
  let m: Mounted;
  let finishers: (() => void)[];
  beforeEach(() => {
    resetAll();
    seatRoom(0);
    finishers = [];
    // jsdom has no Web Animations: record each animation and let the test finish it.
    Element.prototype.animate = vi.fn(function () {
      const anim = { onfinish: null as null | (() => void), cancel: vi.fn() };
      finishers.push(() => anim.onfinish?.());
      return anim as unknown as Animation;
    });
  });
  afterEach(() => {
    m?.unmount();
    usePrefsStore.setState({ motion: "system" });
    resetAll();
    delete (Element.prototype as Partial<Element>).animate;
  });

  const update = (events: GameEvent[]) =>
    act(() =>
      useGameStore.setState((s) => ({
        version: s.version + 1,
        lastEvents: events,
        source: "update",
      })),
    );
  const cards = () => [...m.container.querySelectorAll("[data-testid=card-flight]")];

  it("draws one card per transfer and removes it when it lands", () => {
    showGame(playState({ seat: 1 }), 0);
    m = mount(<CardFlights />);
    update([produced, stole]);
    expect(cards().map((c) => c.getAttribute("data-face"))).toEqual(["grain", "grain", "back"]);
    act(() => finishers.forEach((f) => f()));
    expect(cards()).toEqual([]);
  });

  it("draws nothing for a snapshot or under reduced motion", () => {
    showGame(playState({ seat: 1 }), 0);
    m = mount(<CardFlights />);
    showGame(playState({ seat: 1 }), 0, { version: 4, lastEvents: [produced] });
    expect(cards()).toEqual([]);
    act(() => usePrefsStore.setState({ motion: "reduce" }));
    update([produced]);
    expect(cards()).toEqual([]);
  });
});
