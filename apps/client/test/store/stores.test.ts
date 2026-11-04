import { describe, expect, it } from "vite-plus/test";
import { useConnectionStore } from "../../src/store/connection.ts";
import { useGameStore } from "../../src/store/game.ts";

describe("stores", () => {
  it("start empty", () => {
    expect(useGameStore.getState().view).toBeNull();
    expect(useConnectionStore.getState()).toMatchObject({
      status: "connecting",
      latencyMs: null,
      serverVersion: null,
      protocolVersion: null,
      attempts: 0,
    });
  });
});
