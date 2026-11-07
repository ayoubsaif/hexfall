// Which roll's dice have come to rest on the board (openspec physics-dice-3d, design
// decision 9). The board dice set it when a throw ends (at once for a static display); the
// HUD tray reads it to announce the roll.
import { create } from "zustand";

interface DiceState {
  /** Log index of the latest roll whose dice are at rest, or null. */
  settledIndex: number | null;
  /**
   * A dice throw is playing: no game action may be taken until it ends (openspec
   * pace-bots-and-dice, specs/board-dice "No actions while the dice roll"). Set by the HUD tray.
   */
  rolling: boolean;
}

export const useDiceStore = create<DiceState>(() => ({ settledIndex: null, rolling: false }));

export function setDiceRolling(rolling: boolean): void {
  if (useDiceStore.getState().rolling !== rolling) useDiceStore.setState({ rolling });
}

export function setDiceSettled(index: number): void {
  if (useDiceStore.getState().settledIndex !== index)
    useDiceStore.setState({ settledIndex: index });
}

export function resetDice(): void {
  useDiceStore.setState({ settledIndex: null, rolling: false });
}
