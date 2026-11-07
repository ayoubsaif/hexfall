// Building sound effects: event table, component triggers and the sample loader.
import { act } from "react";
import type { GameEvent } from "@hexfall/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { soundsForEvents } from "../../src/audio/eventSounds.ts";
import { LATE_MS, loadSample, playSample } from "../../src/audio/samples.ts";
import { GameSounds } from "../../src/hud/GameSounds.tsx";
import { useGameStore } from "../../src/store/game.ts";
import { playState } from "../game/fixtures.ts";
import { mount, resetAll, seatRoom, showGame, type Mounted } from "./helpers.tsx";

const played = vi.hoisted(() => [] as string[]);
vi.mock("../../src/audio/sounds.ts", () => ({
  playSound: (name: string) => played.push(name),
  preloadSounds: () => {},
}));

const built = (piece: "road" | "settlement" | "city", free = false): GameEvent => ({
  type: "built",
  seat: 1,
  piece,
  at: 3,
  free,
});
const roll: GameEvent = { type: "diceRolled", seat: 1, dice: [2, 3], total: 5 };

describe("soundsForEvents", () => {
  it("gives each piece its own build sound", () => {
    expect(soundsForEvents([built("road")])).toEqual(["buildRoad"]);
    expect(soundsForEvents([built("settlement", true)])).toEqual(["buildSettlement"]);
    expect(soundsForEvents([built("city")])).toEqual(["buildCity"]);
  });

  it("plays each sound once per batch and ignores events without a sound", () => {
    expect(soundsForEvents([built("road", true), built("road", true)])).toEqual(["buildRoad"]);
    expect(soundsForEvents([roll])).toEqual([]);
  });
});

describe("GameSounds", () => {
  let m: Mounted;
  beforeEach(() => {
    resetAll();
    played.length = 0;
    seatRoom(0);
  });
  afterEach(() => {
    m?.unmount();
    resetAll();
  });

  const update = (events: GameEvent[]) =>
    act(() =>
      useGameStore.setState((s) => ({
        version: s.version + 1,
        lastEvents: events,
        source: "update",
      })),
    );

  it("plays the build sound for a live build by any player, once", () => {
    showGame(playState({ seat: 1 }), 0);
    m = mount(<GameSounds />);
    update([built("settlement")]);
    expect(played).toEqual(["buildSettlement"]);
    act(() => useGameStore.setState({ inFlight: true }));
    expect(played).toEqual(["buildSettlement"]);
  });

  it("stays silent for builds inside a snapshot", () => {
    showGame(playState({ seat: 1 }), 0);
    m = mount(<GameSounds />);
    showGame(playState({ seat: 1 }), 0, { version: 4, lastEvents: [built("city")] });
    expect(played).toEqual([]);
  });
});

describe("samples", () => {
  function fakeCtx() {
    const started: number[] = [];
    const ctx = {
      decodeAudioData: vi.fn(async () => ({ duration: 1 }) as unknown as AudioBuffer),
      createBufferSource: () => {
        const n = {
          buffer: null as unknown,
          playbackRate: { value: 1 },
          connect: vi.fn((x: unknown) => x),
          start: vi.fn(() => started.push(n.playbackRate.value)),
        };
        return n;
      },
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn((x: unknown) => x) }),
    };
    return { ctx: ctx as unknown as AudioContext, started, decode: ctx.decodeAudioData };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches and decodes a file once, then plays it at the asked speed", async () => {
    const fetch = vi.fn(async () => new Response(new ArrayBuffer(8)));
    vi.stubGlobal("fetch", fetch);
    const { ctx, started, decode } = fakeCtx();
    playSample(ctx, {} as AudioNode, "build", { rate: 1.15 });
    await loadSample(ctx, "build");
    await Promise.resolve();
    expect(started).toEqual([1.15]);
    playSample(ctx, {} as AudioNode, "build");
    expect(started).toEqual([1.15, 1]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it("drops a sound that loads too late, and a missing file never throws", async () => {
    let finish!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (finish = r))));
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const { ctx, started } = fakeCtx();
    playSample(ctx, {} as AudioNode, "build");
    now.mockReturnValue(LATE_MS + 1);
    finish(new Response(new ArrayBuffer(8)));
    await loadSample(ctx, "build");
    await Promise.resolve();
    expect(started).toEqual([]);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const other = fakeCtx();
    await expect(loadSample(other.ctx, "build")).resolves.toBeNull();
    now.mockRestore();
  });
});
