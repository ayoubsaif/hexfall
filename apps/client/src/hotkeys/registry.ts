// Keyboard shortcut registry (specs/keyboard-shortcuts "Shortcut registry"). The single source
// for key handling, button hints and the Settings list. Keys are `KeyboardEvent.key` values,
// lowercased.

export type HotkeyId =
  | "rollDice"
  | "buildRoad"
  | "buildSettlement"
  | "buildCity"
  | "buyDevCard"
  | "tradeBank"
  | "tradePlayers"
  | "endTurn"
  | "playKnight"
  | "zoomIn"
  | "zoomOut"
  | "cycleView"
  | "showHotkeys";

export type HotkeyGroup = "turn" | "build" | "cards" | "view" | "general";

export interface Hotkey {
  id: HotkeyId;
  /** First key is the one shown in hints. */
  keys: readonly string[];
  group: HotkeyGroup;
}

export const GROUPS: readonly HotkeyGroup[] = ["turn", "build", "cards", "view", "general"];

export const HOTKEYS: readonly Hotkey[] = [
  { id: "rollDice", keys: [" ", "r"], group: "turn" },
  { id: "tradeBank", keys: ["b"], group: "turn" },
  { id: "tradePlayers", keys: ["t"], group: "turn" },
  { id: "endTurn", keys: ["e", "enter"], group: "turn" },
  { id: "buildRoad", keys: ["1"], group: "build" },
  { id: "buildSettlement", keys: ["2"], group: "build" },
  { id: "buildCity", keys: ["3"], group: "build" },
  { id: "buyDevCard", keys: ["d"], group: "cards" },
  { id: "playKnight", keys: ["k"], group: "cards" },
  { id: "zoomIn", keys: ["+", "="], group: "view" },
  { id: "zoomOut", keys: ["-", "_"], group: "view" },
  { id: "cycleView", keys: ["v"], group: "view" },
  { id: "showHotkeys", keys: ["?"], group: "general" },
];

export function hotkeyFor(id: HotkeyId): Hotkey {
  return HOTKEYS.find((h) => h.id === id)!;
}

/** The hotkey a pressed key triggers, or null. Case-insensitive. */
export function matchHotkey(key: string): Hotkey | null {
  const k = key.length === 1 ? key.toLowerCase() : key.toLowerCase();
  return HOTKEYS.find((h) => h.keys.includes(k)) ?? null;
}

/** Keycap text for a key: "Space", "Enter", "R", "+". */
export function keyLabel(key: string): string {
  if (key === " ") return "Space";
  if (key === "enter") return "Enter";
  return key.length === 1 ? key.toUpperCase() : key;
}

/** Keycap text of an action's main key, e.g. "E". */
export function hotkeyLabel(id: HotkeyId): string {
  return keyLabel(hotkeyFor(id).keys[0]!);
}
