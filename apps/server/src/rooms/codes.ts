// Room codes, display names, seat tokens and game seeds (design.md decision 7).
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** No look-alikes: no 0/O, 1/I/L. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const NAME_MAX = 20;

const SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** A fresh random room code. */
export function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Upper-cases and trims user input; null unless it is a well-formed code. */
export function normalizeCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export type NameResult = { ok: true; name: string } | { ok: false; message: string };

/**
 * Trims and NFC-normalizes a display name and checks it: 1–20 characters, no control
 * characters, not equal (ignoring case) to any of `taken`.
 */
export function validateName(input: string, taken: readonly string[] = []): NameResult {
  const name = input.normalize("NFC").trim();
  // Length in user-perceived characters (grapheme clusters).
  let length = 0;
  for (const _ of SEGMENTER.segment(name)) length++;
  if (length < 1 || length > NAME_MAX) {
    return { ok: false, message: `name must be 1-${NAME_MAX} characters` };
  }
  if (/\p{Cc}/u.test(name)) return { ok: false, message: "name contains control characters" };
  const key = nameKey(name);
  if (taken.some((t) => nameKey(t) === key)) {
    return { ok: false, message: "name is already taken in this room" };
  }
  return { ok: true, name };
}

function nameKey(name: string): string {
  return name.normalize("NFC").toLocaleLowerCase("en");
}

/** A secret seat token: 32 random bytes, base64url. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex of a token (the only form that is stored). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time check of a token against a stored hash. */
export function tokenMatches(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A fresh unpredictable game seed: 16 random bytes, hex. */
export function generateSeed(): string {
  return randomBytes(16).toString("hex");
}
