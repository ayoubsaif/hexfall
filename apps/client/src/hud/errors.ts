// Plain-words text for server error codes (room errors and rule rejections), in the
// active language. Unknown codes fall back to the server's own message.
import type { ErrorCode } from "@hexfall/protocol";
import type { T } from "../i18n/index.ts";

export function roomErrorText(code: ErrorCode, fallback: string, t: T): string {
  return t(`errors.room.${code}`, { defaultValue: fallback });
}

export function ruleErrorText(code: string, fallback: string, t: T): string {
  // Codes come off the wire, so they are not guaranteed to be known keys.
  return t(`errors.rule.${code}` as "errors.rule.invalid_action", { defaultValue: fallback });
}
