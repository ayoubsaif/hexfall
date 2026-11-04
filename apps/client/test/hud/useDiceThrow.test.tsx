// useDiceThrow (openspec dice-tray-3d, task 2.1).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { DiceRoll } from "../../src/game/status.ts";
import { type DiceThrow, useDiceThrow } from "../../src/hud/dice/useDiceThrow.ts";
import { resetGame, useGameStore } from "../../src/store/game.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let seen: DiceThrow[] = [];

function Probe({ roll }: { roll: DiceRoll | null }) {
  seen.push(useDiceThrow(roll));
  return null;
}
const roll = (index: number): DiceRoll => ({ dice: [3, 4], seat: 0, index });
const motion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduce && q.includes("reduce"),
    media: q,
  }));

beforeEach(() => {
  seen = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  motion(false);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  act(() => resetGame());
});

describe("useDiceThrow", () => {
  it("animates a new roll that arrived as an update", () => {
    act(() => useGameStore.setState({ source: "update" }));
    act(() => root.render(<Probe roll={null} />));
    const first = seen.at(-1)!;
    act(() => root.render(<Probe roll={roll(5)} />));
    expect(seen.at(-1)).toEqual({ key: first.key + 1, mode: "animate" });
  });

  it("shows a roll from a snapshot statically", () => {
    act(() => useGameStore.setState({ source: "snapshot" }));
    act(() => root.render(<Probe roll={null} />));
    act(() => root.render(<Probe roll={roll(5)} />));
    expect(seen.at(-1)!.mode).toBe("static");
  });

  it("starts static when mounted with a roll already present", () => {
    act(() => useGameStore.setState({ source: "update" }));
    act(() => root.render(<Probe roll={roll(5)} />));
    expect(seen.at(-1)!.mode).toBe("static");
  });

  it("never animates under reduced motion", () => {
    motion(true);
    act(() => useGameStore.setState({ source: "update" }));
    act(() => root.render(<Probe roll={null} />));
    act(() => root.render(<Probe roll={roll(5)} />));
    expect(seen.at(-1)!.mode).toBe("static");
  });

  it("does not replay the same roll on re-render, and re-keys the next one", () => {
    act(() => useGameStore.setState({ source: "update" }));
    act(() => root.render(<Probe roll={null} />));
    act(() => root.render(<Probe roll={roll(5)} />));
    const thrown = seen.at(-1)!;
    act(() => root.render(<Probe roll={roll(5)} />));
    expect(seen.at(-1)).toEqual(thrown);
    act(() => root.render(<Probe roll={roll(9)} />));
    expect(seen.at(-1)!.key).toBe(thrown.key + 1);
    expect(seen.at(-1)!.mode).toBe("animate");
  });
});
