import {
  DEFAULT_VICTORY_TARGET as ENGINE_DEFAULT,
  MAX_VICTORY_TARGET as ENGINE_MAX,
  MIN_VICTORY_TARGET as ENGINE_MIN,
  SPECIAL_BUILD_MIN_PLAYERS,
  rulesProfile,
} from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_VICTORY_TARGET,
  LARGE_BOARD_SEATS,
  MAX_VICTORY_TARGET,
  MIN_VICTORY_TARGET,
  bankPerResource,
} from "../../src/game/extension.ts";
import { maxAsk } from "../../src/game/cards.ts";

describe("client copy of the extension numbers", () => {
  it("matches the engine", () => {
    expect([MIN_VICTORY_TARGET, MAX_VICTORY_TARGET, DEFAULT_VICTORY_TARGET]).toEqual([
      ENGINE_MIN,
      ENGINE_MAX,
      ENGINE_DEFAULT,
    ]);
    expect(LARGE_BOARD_SEATS).toBe(SPECIAL_BUILD_MIN_PLAYERS);
    for (const n of [3, 4, 5, 6]) {
      expect(bankPerResource(n)).toBe(rulesProfile(n as 3 | 4 | 5 | 6).bankPerResource);
    }
  });

  it("lets a trade ask for the full bank stack", () => {
    expect(maxAsk(4)).toBe(19);
    expect(maxAsk(6)).toBe(24);
  });
});
