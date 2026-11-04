import { describe, expect, it } from "vite-plus/test";
import {
  CODE_ALPHABET,
  generateCode,
  generateSeed,
  generateToken,
  hashToken,
  normalizeCode,
  tokenMatches,
  validateName,
} from "../src/rooms/codes.ts";

describe("room codes", () => {
  it("are 6 characters from an alphabet without look-alikes", () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    for (const ch of "01OIL") expect(CODE_ALPHABET).not.toContain(ch);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(490);
  });

  it("normalize case-insensitively and reject malformed input", () => {
    expect(normalizeCode("abc234")).toBe("ABC234");
    expect(normalizeCode("  xyz789 ")).toBe("XYZ789");
    expect(normalizeCode("ABC23")).toBeNull();
    expect(normalizeCode("ABC2345")).toBeNull();
    expect(normalizeCode("ABC0EF")).toBeNull();
    expect(normalizeCode("ABCIEF")).toBeNull();
    expect(normalizeCode("")).toBeNull();
  });
});

describe("display names", () => {
  it("are trimmed and NFC-normalized", () => {
    expect(validateName("  Ana ")).toEqual({ ok: true, name: "Ana" });
    const decomposed = "José";
    const r = validateName(decomposed);
    expect(r).toEqual({ ok: true, name: "José" });
  });

  it("must be 1-20 characters", () => {
    expect(validateName("").ok).toBe(false);
    expect(validateName("   ").ok).toBe(false);
    expect(validateName("a".repeat(20)).ok).toBe(true);
    expect(validateName("a".repeat(21)).ok).toBe(false);
  });

  it("reject control characters", () => {
    expect(validateName("A\u0000na").ok).toBe(false);
    expect(validateName("A\nna").ok).toBe(false);
    expect(validateName("A\u007fna").ok).toBe(false);
  });

  it("must be unique ignoring case", () => {
    expect(validateName("ana", ["Ana"]).ok).toBe(false);
    expect(validateName("ÉVA", ["éva"]).ok).toBe(false);
    expect(validateName("Ben", ["Ana"]).ok).toBe(true);
  });
});

describe("seat tokens", () => {
  it("have 256 bits and hash to SHA-256 hex", () => {
    const t = generateToken();
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(generateToken()).not.toBe(t);
  });

  it("match their own hash only", () => {
    const t = generateToken();
    const h = hashToken(t);
    expect(tokenMatches(t, h)).toBe(true);
    expect(tokenMatches(generateToken(), h)).toBe(false);
    expect(tokenMatches(t, "abc")).toBe(false);
    expect(tokenMatches("", h)).toBe(false);
  });
});

describe("seeds", () => {
  it("are 16 random bytes in hex", () => {
    const s = generateSeed();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSeed()).not.toBe(s);
  });
});
