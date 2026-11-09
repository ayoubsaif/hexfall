// Typed rule errors (design.md decision 3). applyAction catches only RuleError.

export type RuleErrorCode =
  | "invalid_config"
  | "invalid_action"
  | "game_over"
  | "not_your_turn"
  | "wrong_phase"
  | "must_roll_first"
  | "already_rolled"
  | "illegal_placement"
  | "insufficient_resources"
  | "no_pieces"
  | "invalid_discard"
  | "illegal_robber_hex"
  | "illegal_victim"
  | "deck_empty"
  | "card_not_playable"
  | "dev_card_already_played"
  | "cannot_reveal"
  | "invalid_trade"
  | "unknown_offer"
  | "bank_empty"
  | "not_allowed_in_special_build";

export class RuleError extends Error {
  readonly code: RuleErrorCode;
  constructor(code: RuleErrorCode, message: string) {
    super(message);
    this.name = "RuleError";
    this.code = code;
  }
}

/** Throws a RuleError unless `condition` holds. */
export function check(condition: unknown, code: RuleErrorCode, message: string): asserts condition {
  if (!condition) throw new RuleError(code, message);
}
