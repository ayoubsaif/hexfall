import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useConnectionStore } from "../../src/store/connection.ts";
import { resetGame, useGameStore } from "../../src/store/game.ts";
import { resetRoom, useRoomStore } from "../../src/store/room.ts";
import {
  bindUiToGame,
  clearIntent,
  chooseBuild,
  dismissToast,
  intentKey,
  openDialog,
  openTrade,
  pushToast,
  resetUi,
  setVictimHex,
  useUiStore,
} from "../../src/store/ui.ts";
import { playState, seen, setupState } from "../game/fixtures.ts";

afterEach(() => {
  resetGame();
  resetRoom({ prefillRoom: null, notice: null });
  resetUi();
  vi.useRealTimers();
});

describe("stores", () => {
  it("start empty", () => {
    expect(useGameStore.getState()).toMatchObject({
      version: -1,
      view: null,
      legal: null,
      log: [],
      inFlight: false,
      source: null,
    });
    expect(useRoomStore.getState()).toMatchObject({ room: null, seat: null, seats: [] });
    expect(useUiStore.getState()).toMatchObject({ build: null, victimHex: null, dialog: null });
    expect(useConnectionStore.getState()).toMatchObject({
      status: "connecting",
      latencyMs: null,
      serverVersion: null,
      protocolVersion: null,
      attempts: 0,
    });
  });

  it("reset helpers restore the initial state", () => {
    const { view, legal } = seen(setupState(), 0);
    useGameStore.setState({ version: 3, view, legal, inFlight: true });
    resetGame();
    expect(useGameStore.getState().view).toBeNull();
    expect(useGameStore.getState().version).toBe(-1);

    useRoomStore.setState({ room: "ABCDEF", seat: 1, prefillRoom: "ABCDEF", notice: "hi" });
    resetRoom();
    expect(useRoomStore.getState()).toMatchObject({
      room: null,
      seat: null,
      prefillRoom: "ABCDEF",
      notice: "hi",
    });
  });

  it("build, victim and dialog intent are exclusive where needed", () => {
    chooseBuild("road");
    expect(useUiStore.getState().build).toBe("road");
    openDialog("maritime");
    expect(useUiStore.getState()).toMatchObject({ build: null, dialog: "maritime" });
    setVictimHex(4);
    chooseBuild("city");
    expect(useUiStore.getState()).toMatchObject({ build: "city", victimHex: null, dialog: null });
  });

  it("opening the trade composer stores a fresh draft; other intent drops it", () => {
    chooseBuild("road");
    openTrade({ give: { ore: 1 }, get: {}, to: [1, 2] });
    const first = useUiStore.getState().tradeDraft;
    expect(useUiStore.getState()).toMatchObject({ build: null, dialog: "trade" });
    expect(first).toMatchObject({ give: { ore: 1 }, get: {}, to: [1, 2] });
    openTrade({ give: {}, get: {}, to: [3] });
    expect(useUiStore.getState().tradeDraft?.id).not.toBe(first?.id);
    openDialog(null);
    expect(useUiStore.getState()).toMatchObject({ dialog: null, tradeDraft: null });
    openTrade({ give: {}, get: {}, to: [3] });
    chooseBuild("city");
    expect(useUiStore.getState().tradeDraft).toBeNull();
    openTrade({ give: {}, get: {}, to: [3] });
    clearIntent();
    expect(useUiStore.getState()).toMatchObject({ dialog: null, tradeDraft: null });
    openTrade({ give: {}, get: {}, to: [3] });
    resetUi();
    expect(useUiStore.getState().tradeDraft).toBeNull();
  });

  it("toasts close on their own", () => {
    vi.useFakeTimers();
    const id = pushToast("Your turn", "good", 1000);
    expect(useUiStore.getState().toasts.map((t) => t.text)).toEqual(["Your turn"]);
    vi.advanceTimersByTime(1000);
    expect(useUiStore.getState().toasts).toEqual([]);
    pushToast("x", "info", 0);
    dismissToast(id);
    expect(useUiStore.getState().toasts).toHaveLength(1);
  });
});

describe("ui intent follows the game", () => {
  it("clears intent when the phase or turn changes, not on other updates", () => {
    const unbind = bindUiToGame();
    const a = seen(playState({ seat: 0 }), 0);
    useGameStore.setState({ view: a.view, legal: a.legal });
    chooseBuild("road");

    // Same phase and turn (only the bank changed): intent stays.
    useGameStore.setState({ view: { ...a.view, bank: { ...a.view.bank, ore: 1 } } });
    expect(useUiStore.getState().build).toBe("road");

    // Robber phase: intent cleared.
    useGameStore.setState({ view: { ...a.view, phase: { kind: "moveRobber", source: "knight" } } });
    expect(useUiStore.getState().build).toBeNull();

    // Next turn: cleared again.
    chooseBuild("city");
    const b = seen(playState({ seat: 1 }), 0);
    useGameStore.setState({ view: b.view });
    expect(useUiStore.getState().build).toBeNull();
    unbind();
  });

  it("intentKey distinguishes setup steps", () => {
    const { view } = seen(setupState(), 0);
    const roadStep = { ...view, phase: { ...view.phase, step: "road" } } as typeof view;
    expect(intentKey(view)).not.toBe(intentKey(roadStep));
    expect(intentKey(null)).toBe("none");
  });
});
