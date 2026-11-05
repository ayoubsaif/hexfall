// Turn chime, dice sound and the sound switch (specs/game-audio).
import { act } from "react";
import type { GameEvent, LegalActions, PlayerView } from "@hexfall/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { viewerWait } from "../../src/alerts/wait.ts";
import { GameAlerts } from "../../src/hud/GameAlerts.tsx";
import { SoundSection } from "../../src/settings/sections/SoundSection.tsx";
import { useGameStore } from "../../src/store/game.ts";
import { DEFAULT_PREFS, usePrefsStore } from "../../src/store/prefs.ts";
import { playState, seen } from "../game/fixtures.ts";
import { click, mount, resetAll, seatRoom, showGame, type Mounted } from "./helpers.tsx";

const played = vi.hoisted(() => [] as string[]);
vi.mock("../../src/audio/sounds.ts", () => ({
  playSound: (name: string) => played.push(name),
}));

let m: Mounted;
beforeEach(() => {
  resetAll();
  played.length = 0;
  usePrefsStore.setState({ ...DEFAULT_PREFS });
  seatRoom(0);
});
afterEach(() => {
  m?.unmount();
  resetAll();
});

function update(state: ReturnType<typeof playState>, seat: 0 | 1 | 2 | 3, events: GameEvent[]) {
  const { view, legal } = seen(state, seat);
  act(() =>
    useGameStore.setState((s) => ({
      version: s.version + 1,
      view,
      legal,
      lastEvents: events,
      log: [...s.log, ...events],
      source: "update",
    })),
  );
}

const roll = (seat: 0 | 1 | 2 | 3): GameEvent =>
  ({ type: "diceRolled", seat, dice: [2, 3] }) as unknown as GameEvent;

describe("viewerWait", () => {
  const legal = (over: Partial<LegalActions>): LegalActions =>
    ({
      rollForOrder: false,
      placeSettlement: [],
      placeRoad: [],
      rollDice: false,
      discard: 0,
      ...over,
    }) as LegalActions;
  const view = { winner: null } as unknown as PlayerView;

  it("names each wait kind", () => {
    expect(viewerWait(view, legal({ rollForOrder: true }))).toBe("rollForOrder");
    expect(viewerWait(view, legal({ discard: 4 }))).toBe("discard");
    expect(viewerWait(view, legal({ placeSettlement: [1] }))).toBe("setup");
    expect(viewerWait(view, legal({ placeRoad: [1] }))).toBe("setup");
    expect(viewerWait(view, legal({ rollDice: true }))).toBe("turn");
    expect(viewerWait(view, legal({}))).toBeNull();
  });

  it("is null once the game is over", () => {
    const over = { winner: 1 } as unknown as PlayerView;
    expect(viewerWait(over, legal({ rollDice: true }))).toBeNull();
  });
});

describe("GameAlerts (specs/game-audio)", () => {
  it("does not chime for a snapshot of the viewer's own roll wait", () => {
    showGame(playState({ seat: 0, rolled: false }), 0);
    m = mount(<GameAlerts />);
    showGame(playState({ seat: 0, rolled: false }), 0, { version: 2 });
    expect(played).toEqual([]);
  });

  it("chimes once when the turn passes to the viewer", () => {
    showGame(playState({ seat: 3 }), 0);
    m = mount(<GameAlerts />);
    update(playState({ seat: 0, rolled: false }), 0, []);
    expect(played).toEqual(["chime"]);
    update(playState({ seat: 0, rolled: false }), 0, []);
    act(() => useGameStore.setState({ inFlight: true }));
    expect(played).toEqual(["chime"]);
  });

  it("plays the dice sound for any seat's live roll, once", () => {
    showGame(playState({ seat: 3, rolled: false }), 0);
    m = mount(<GameAlerts />);
    update(playState({ seat: 3, rolled: true }), 0, [roll(3)]);
    expect(played).toEqual(["dice"]);
    act(() => useGameStore.setState({ inFlight: true }));
    act(() => useGameStore.setState({ inFlight: false }));
    expect(played).toEqual(["dice"]);
  });

  it("plays no dice sound for rolls inside a snapshot", () => {
    showGame(playState({ seat: 3 }), 0);
    m = mount(<GameAlerts />);
    showGame(playState({ seat: 3 }), 0, { version: 5, lastEvents: [roll(3)] });
    expect(played).toEqual([]);
  });

  it("does not chime after the game has ended", () => {
    showGame(playState({ seat: 3 }), 0);
    m = mount(<GameAlerts />);
    const s = playState({ seat: 0, rolled: false });
    s.winner = 2;
    update(s, 0, []);
    expect(played).toEqual([]);
  });
});

describe("SoundSection (specs/game-audio 'Mute setting', client-settings 'Sound section')", () => {
  it("switches sounds off and disables the volume and test controls", () => {
    m = mount(<SoundSection />);
    const sw = () =>
      m.container.querySelector<HTMLButtonElement>('[data-testid="settings-sound"]')!;
    const test = () =>
      m.container.querySelector<HTMLButtonElement>('[data-testid="settings-test-sound"]')!;
    expect(sw().getAttribute("aria-checked")).toBe("true");
    expect(test().disabled).toBe(false);
    click(sw());
    expect(usePrefsStore.getState().sound).toBe(false);
    expect(sw().getAttribute("aria-checked")).toBe("false");
    expect(test().disabled).toBe(true);
    expect(
      m.container.querySelector('[data-testid="settings-volume"]')?.hasAttribute("data-disabled"),
    ).toBe(true);
  });
});
