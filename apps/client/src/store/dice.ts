// Which roll's dice have come to rest on the board (openspec physics-dice-3d, design
// decision 9). The board dice set it when a throw ends (at once for a static display); the
// HUD tray reads it to announce the roll.
import { create } from "zustand";

interface DiceState {
  /** Log index of the latest roll whose dice are at rest, or null. */
  settledIndex: number | null;
}

export const useDiceStore = create<DiceState>(() => ({ settledIndex: null }));

export function setDiceSettled(index: number): void {
  if (useDiceStore.getState().settledIndex !== index) useDiceStore.setState({ settledIndex: index });
}

export function resetDice(): void {
  useDiceStore.setState({ settledIndex: null });
}
