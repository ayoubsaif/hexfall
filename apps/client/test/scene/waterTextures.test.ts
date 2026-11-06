import { Texture } from "three";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  STILL_WATER_TIME,
  isLowPower,
  loadWaterTextures,
  waterTime,
} from "../../src/scene/waterTextures.ts";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("loadWaterTextures", () => {
  it("loads only the declared slots", async () => {
    const onSlot = vi.fn();
    const fetcher = vi.fn(async () => new Texture());
    loadWaterTextures({ sand: "/s.webp" }, onSlot, undefined, fetcher);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onSlot).toHaveBeenCalledWith("sand", expect.any(Texture));
  });

  it("with no urls loads nothing and never throws (procedural fallback)", () => {
    const onSlot = vi.fn();
    const fetcher = vi.fn();
    expect(() => loadWaterTextures({}, onSlot, undefined, fetcher)).not.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(onSlot).not.toHaveBeenCalled();
  });

  it("reports a failing slot and still loads the others", async () => {
    const onSlot = vi.fn();
    const onError = vi.fn();
    const fetcher = async (url: string) => {
      if (url === "/bad.webp") throw new Error("decode failed");
      return new Texture();
    };
    loadWaterTextures({ caustics: "/bad.webp", sand: "/ok.webp" }, onSlot, onError, fetcher);
    await flush();
    expect(onError).toHaveBeenCalledWith("caustics", "/bad.webp", expect.any(Error));
    expect(onSlot).toHaveBeenCalledTimes(1);
    expect(onSlot).toHaveBeenCalledWith("sand", expect.any(Texture));
  });

  it("reports a fetcher that throws synchronously", () => {
    const onError = vi.fn();
    loadWaterTextures({ sand: "/s.webp" }, vi.fn(), onError, () => {
      throw new Error("boom");
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("drops and disposes textures that arrive after cancel", async () => {
    const onSlot = vi.fn();
    const tex = new Texture();
    const dispose = vi.spyOn(tex, "dispose");
    const cancel = loadWaterTextures({ sand: "/s.webp" }, onSlot, undefined, async () => tex);
    cancel();
    await flush();
    expect(onSlot).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });
});

describe("isLowPower", () => {
  it("is low on few cores or dense small screens", () => {
    expect(isLowPower({ hardwareConcurrency: 4 }, 1, 1000)).toBe(true);
    expect(isLowPower({ hardwareConcurrency: 8 }, 3, 400)).toBe(true);
  });
  it("is not low on a capable desktop", () => {
    expect(isLowPower({ hardwareConcurrency: 8 }, 1, 1000)).toBe(false);
    expect(isLowPower({ hardwareConcurrency: 8 }, 3, 1000)).toBe(false);
  });
});

describe("waterTime", () => {
  it("is constant under reduced motion and follows the clock otherwise", () => {
    expect(waterTime(true, 0)).toBe(STILL_WATER_TIME);
    expect(waterTime(true, 99)).toBe(STILL_WATER_TIME);
    expect(waterTime(false, 5)).toBe(5);
  });
});
