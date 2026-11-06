// specs/keyboard-shortcuts: shortcuts trigger the same actions as the buttons.
import { give, playState, put } from "../game/fixtures.ts";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hud } from "../../src/hud/Hud.tsx";
import { useSettingsStore } from "../../src/settings/sections.ts";
import { useUiStore } from "../../src/store/ui.ts";
import {
  actions,
  mount,
  recordSession,
  resetAll,
  seatRoom,
  showGame,
  type Call,
  type Mounted,
} from "../hud/helpers.tsx";

let m: Mounted;
let calls: Call[];

beforeEach(() => {
  resetAll();
  calls = recordSession();
  useSettingsStore.setState({ open: false, section: "language" });
});
afterEach(() => {
  m?.unmount();
  document.body.innerHTML = "";
  resetAll();
});

function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });
}

describe("hotkeys", () => {
  it("E ends the turn when enabled, once per press", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<Hud />);
    press("e");
    expect(actions(calls)).toEqual([{ type: "endTurn" }]);
  });

  it("Space rolls before the roll; nothing after it", () => {
    seatRoom(0);
    showGame(playState({ rolled: false }), 0);
    m = mount(<Hud />);
    press(" ");
    expect(actions(calls)).toEqual([{ type: "rollDice" }]);
    calls.length = 0;
    showGame(playState({ rolled: true }), 0);
    press("r");
    expect(actions(calls)).toEqual([]);
  });

  it("does nothing on another player's turn", () => {
    seatRoom(0);
    showGame(playState({ seat: 2 }), 0);
    m = mount(<Hud />);
    press("e");
    press("d");
    expect(actions(calls)).toEqual([]);
  });

  it("does nothing when the action is not affordable", () => {
    seatRoom(0);
    const s = playState();
    for (const r of ["brick", "lumber", "wool", "grain", "ore"] as const)
      s.players[0]!.resources[r] = 0;
    showGame(s, 0);
    m = mount(<Hud />);
    press("d");
    press("3");
    expect(actions(calls)).toEqual([]);
    expect(useUiStore.getState().build).toBeNull();
  });

  it("D buys a development card when affordable; 1 toggles road build", () => {
    seatRoom(0);
    const s = playState();
    put(s, 10, 0);
    give(s, 0, { brick: 2, lumber: 2, ore: 1, wool: 1, grain: 1 });
    showGame(s, 0);
    m = mount(<Hud />);
    press("D");
    expect(actions(calls)).toEqual([{ type: "buyDevCard" }]);
    press("1");
    expect(useUiStore.getState().build).toBe("road");
    press("1");
    expect(useUiStore.getState().build).toBeNull();
  });

  it("ignores keys while typing and with Ctrl", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<Hud />);
    const input = document.createElement("input");
    document.body.append(input);
    press("e", {}, input);
    press("e", { ctrlKey: true });
    press("e", { repeat: true });
    expect(actions(calls)).toEqual([]);
  });

  it("? opens Settings on the Keyboard section", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<Hud />);
    press("?", { shiftKey: true });
    expect(useSettingsStore.getState()).toMatchObject({ open: true, section: "keyboard" });
  });

  it("tooltips and aria expose the key", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<Hud />);
    const end = document.querySelector<HTMLButtonElement>('button[aria-label="End turn"]');
    expect(end?.getAttribute("aria-keyshortcuts")).toBe("e enter");
  });
});
