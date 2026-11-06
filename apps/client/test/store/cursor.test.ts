import { describe, expect, it } from "vite-plus/test";
import { resolveCursor } from "../../src/store/cursor.ts";

describe("resolveCursor", () => {
  it("is grab when idle", () => {
    expect(resolveCursor({ dragging: false, overTarget: false })).toBe("grab");
  });
  it("is pointer over a target", () => {
    expect(resolveCursor({ dragging: false, overTarget: true })).toBe("pointer");
  });
  it("grabbing wins over pointer", () => {
    expect(resolveCursor({ dragging: true, overTarget: true })).toBe("grabbing");
  });
});
