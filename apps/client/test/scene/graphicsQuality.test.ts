import { describe, expect, it } from "vite-plus/test";
import { QualitySampler, type QualityTier } from "../../src/scene/graphicsQuality.ts";
import { readPrefs } from "../../src/store/prefs.ts";

describe("graphics preferences", () => {
  const storage = (record: object) => ({
    getItem: () => JSON.stringify(record),
    setItem: () => {},
  });
  it("migrates old preferences without losing them and rejects unknown graphics values", () => {
    expect(
      readPrefs(storage({ sound: false, graphicsMode: "unknown", graphicsQuality: 42 })),
    ).toMatchObject({ sound: false, graphicsMode: "realistic", graphicsQuality: "auto" });
    expect(readPrefs(storage({ graphicsMode: "classic", graphicsQuality: "high" }))).toMatchObject({
      graphicsMode: "classic",
      graphicsQuality: "high",
    });
  });
});

describe("automatic quality", () => {
  const run = (
    sampler: QualitySampler,
    fps: number,
    seconds: number,
    start: QualityTier,
    visible = true,
  ) => {
    let tier = start;
    for (let i = 0; i < fps * seconds; i++) tier = sampler.sample(1 / fps, tier, visible);
    return tier;
  };
  it("requires sustained slow frames, steps down and stays at the floor", () => {
    const s = new QualitySampler();
    expect(run(s, 30, 9, "high")).toBe("high");
    const medium = run(s, 30, 3, "high");
    expect(medium).toBe("medium");
    const low = run(s, 30, 12, medium);
    expect(low).toBe("low");
    expect(run(s, 30, 30, low)).toBe("low");
  });
  it("does not penalize a healthy renderer, background tabs or long resume gaps", () => {
    const s = new QualitySampler();
    expect(run(s, 60, 30, "high")).toBe("high");
    expect(run(s, 20, 30, "high", false)).toBe("high");
    expect(s.sample(20, "high")).toBe("high");
    expect(run(s, 60, 10, "high")).toBe("high");
  });
  it("does not alternate up and down after performance recovers", () => {
    const s = new QualitySampler();
    const tier = run(s, 30, 12, "high");
    expect(run(s, 60, 60, tier)).toBe("medium");
  });
  it("still lowers quality when a very slow device renders below four FPS", () => {
    expect(run(new QualitySampler(), 2, 12, "high")).toBe("medium");
  });
});
