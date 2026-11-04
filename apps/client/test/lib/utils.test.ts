import { describe, expect, it } from "vite-plus/test";
import { cn } from "@/lib/utils.ts";

describe("cn", () => {
  it("lets the later Tailwind utility win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("drops falsy values", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
});
