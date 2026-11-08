// Bot difficulty levels (specs/bots "Bot difficulty levels"). Only which legal move a bot
// picks changes with the level; the rules never do.

export const BOT_LEVELS = ["easy", "normal", "hard"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

/** A stored or received level, or Normal when it is missing or unknown. */
export function toBotLevel(x: unknown): BotLevel {
  return BOT_LEVELS.includes(x as BotLevel) ? (x as BotLevel) : "normal";
}
