// specs/tutorial-mode "Tutorial on by default", "Turning tutorial off and on".
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  parseTutorialCookie,
  readTutorialEnabled,
  serializeTutorialCookie,
  setTutorialEnabled,
  useTutorial,
} from "../../src/store/tutorial.ts";

const clear = () => {
  document.cookie = "hexfall_tutorial=; Path=/; Max-Age=0";
};

afterEach(() => {
  clear();
  useTutorial.setState({ enabled: true });
});

describe("parseTutorialCookie", () => {
  it("no cookie", () => {
    expect(parseTutorialCookie("")).toBeNull();
    expect(parseTutorialCookie("theme=dark")).toBeNull();
  });
  it("on and off", () => {
    expect(parseTutorialCookie("hexfall_tutorial=on")).toBe(true);
    expect(parseTutorialCookie("hexfall_tutorial=off")).toBe(false);
  });
  it("garbage value counts as no cookie", () => {
    expect(parseTutorialCookie("hexfall_tutorial=maybe")).toBeNull();
    expect(parseTutorialCookie("hexfall_tutorial=")).toBeNull();
    expect(parseTutorialCookie("hexfall_tutorial")).toBeNull();
  });
  it("finds it among other cookies", () => {
    expect(parseTutorialCookie("a=1; hexfall_tutorial=off; b=on")).toBe(false);
    expect(parseTutorialCookie("x_hexfall_tutorial=off;  hexfall_tutorial = on ")).toBe(true);
  });
});

describe("serializeTutorialCookie", () => {
  it("path, max-age 365 days, SameSite=Lax", () => {
    expect(serializeTutorialCookie(false, false)).toBe(
      "hexfall_tutorial=off; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });
  it("Secure on https", () => {
    expect(serializeTutorialCookie(true, true)).toBe(
      "hexfall_tutorial=on; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
  });
});

describe("tutorial store", () => {
  it("defaults to on without a cookie", () => {
    clear();
    expect(readTutorialEnabled()).toBe(true);
  });
  it("writes the cookie and reads it back", () => {
    setTutorialEnabled(false);
    expect(useTutorial.getState().enabled).toBe(false);
    expect(document.cookie).toContain("hexfall_tutorial=off");
    expect(readTutorialEnabled()).toBe(false);
    setTutorialEnabled(true);
    expect(document.cookie).toContain("hexfall_tutorial=on");
    expect(readTutorialEnabled()).toBe(true);
  });
  it("a failed write keeps the choice in memory, without throwing", () => {
    const desc =
      Object.getOwnPropertyDescriptor(document, "cookie") ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), "cookie") ??
      Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: () => {
        throw new Error("blocked");
      },
    });
    try {
      expect(() => setTutorialEnabled(false)).not.toThrow();
      expect(useTutorial.getState().enabled).toBe(false);
    } finally {
      delete (document as { cookie?: string }).cookie;
      if (desc && !Object.getOwnPropertyDescriptor(Document.prototype, "cookie")) {
        Object.defineProperty(document, "cookie", desc);
      }
    }
  });
});
