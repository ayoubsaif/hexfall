// Component test helpers: render into happy-dom, record session intents, seed stores.
import type { GameState, Seat } from "@hexfall/engine";
import type { ClientAction } from "@hexfall/protocol";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setSessionApi, type SessionApi } from "../../src/net/actions.ts";
import { initialConnectionState, useConnectionStore } from "../../src/store/connection.ts";
import { resetGame, useGameStore } from "../../src/store/game.ts";
import { resetRoom, useRoomStore } from "../../src/store/room.ts";
import { resetUi } from "../../src/store/ui.ts";
import { seen } from "../game/fixtures.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLDivElement;
  root: Root;
  unmount(): void;
}

export function mount(node: ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    root,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export type Call = { fn: keyof SessionApi; args: unknown[] };

/** Registers a session that records every intent (sends succeed). */
export function recordSession(): Call[] {
  const calls: Call[] = [];
  const rec =
    (fn: keyof SessionApi) =>
    (...args: unknown[]) => {
      calls.push({ fn, args });
      return true;
    };
  setSessionApi({
    act: rec("act") as (a: ClientAction) => boolean,
    createRoom: rec("createRoom") as SessionApi["createRoom"],
    joinRoom: rec("joinRoom") as SessionApi["joinRoom"],
    leaveRoom: rec("leaveRoom") as SessionApi["leaveRoom"],
    startGame: rec("startGame") as SessionApi["startGame"],
    playHere: rec("playHere") as SessionApi["playHere"],
    backToStart: rec("backToStart") as SessionApi["backToStart"],
  });
  return calls;
}

/** Actions sent through `act`. */
export const actions = (calls: Call[]) =>
  calls.filter((c) => c.fn === "act").map((c) => c.args[0] as ClientAction);

export const NAMES = ["Ana", "Ben", "Cy", "Dee"];

/** Seats the viewer in a playing room with names for every seat. */
export function seatRoom(seat: Seat, players = 4, connected: boolean[] = []): void {
  useRoomStore.setState({
    room: "K7QX2M",
    seat,
    host: 0,
    status: "playing",
    seats: NAMES.slice(0, players).map((name, i) => ({
      seat: i,
      name,
      connected: connected[i] ?? true,
    })),
  });
}

/** Puts the view and legal moves of `seat` for a game state into the game store. */
export function showGame(
  s: GameState,
  seat: Seat,
  extra: Partial<ReturnType<typeof useGameStore.getState>> = {},
): void {
  const { view, legal } = seen(s, seat);
  act(() =>
    useGameStore.setState({
      version: 1,
      view,
      legal,
      log: view.log,
      lastEvents: [],
      source: "snapshot",
      ...extra,
    }),
  );
}

export function resetAll(): void {
  act(() => {
    resetGame();
    resetRoom({ prefillRoom: null, notice: null });
    resetUi();
    useConnectionStore.setState({ ...initialConnectionState, status: "open" });
  });
  setSessionApi();
}

export function click(el: Element | null | undefined): void {
  if (!el) throw new Error("no element to click");
  act(() => (el as HTMLElement).click());
}

/** Sets an input's value the way React notices it. */
export function type(el: Element | null | undefined, value: string): void {
  if (!el) throw new Error("no input");
  const input = el as HTMLInputElement;
  const proto = Object.getPrototypeOf(input) as object;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  act(() => {
    desc?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export function byText<T extends Element = HTMLButtonElement>(
  root: ParentNode,
  selector: string,
  text: string | RegExp,
): T | undefined {
  return [...root.querySelectorAll<T>(selector)].find((el) =>
    typeof text === "string" ? el.textContent?.trim() === text : text.test(el.textContent ?? ""),
  );
}
