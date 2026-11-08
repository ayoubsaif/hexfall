// Bot level choices shown in the lobby and the practice form (specs/bots "Bot difficulty levels").
import type { BotLevel } from "@hexfall/protocol";

export const LEVEL_OPTIONS = [
  { value: "easy", label: "session.lobby.levelEasy" },
  { value: "normal", label: "session.lobby.levelNormal" },
  { value: "hard", label: "session.lobby.levelHard" },
] as const satisfies readonly { value: BotLevel; label: string }[];

/** Label key of a bot seat's level (Normal when the server sent none). */
export function levelLabel(level: BotLevel | undefined): (typeof LEVEL_OPTIONS)[number]["label"] {
  return (LEVEL_OPTIONS.find((o) => o.value === level) ?? LEVEL_OPTIONS[1]).label;
}
