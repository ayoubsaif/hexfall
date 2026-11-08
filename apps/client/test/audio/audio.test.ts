import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { audioOutput, installAudioUnlock, resetAudioForTests } from "../../src/audio/engine.ts";
import { playSound } from "../../src/audio/sounds.ts";
import {
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
  readPrefs,
  setPref,
  usePrefsStore,
  writePrefs,
} from "../../src/store/prefs.ts";

/** Minimal fake AudioContext that records started sources. */
function fakeContext(initial: AudioContextState = "suspended") {
  const started: string[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const node = (kind: string) => {
    const n = {
      kind,
      gain: param(),
      frequency: param(),
      playbackRate: param(),
      Q: param(),
      type: "",
      buffer: null as unknown,
      connect: vi.fn(() => n),
      start: vi.fn(() => started.push(kind)),
      stop: vi.fn(),
    };
    return n;
  };
  const gains: ReturnType<typeof node>[] = [];
  const ctx = {
    gains,
    state: initial,
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createGain: () => {
      const g = node("gain");
      gains.push(g);
      return g;
    },
    createOscillator: () => node("osc"),
    createBufferSource: () => node("noise"),
    createBiquadFilter: () => node("filter"),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
  };
  return {
    ctx: ctx as unknown as AudioContext & { state: AudioContextState },
    started,
    gains,
  };
}

function fakeTarget() {
  const listeners = new Map<string, EventListener>();
  return {
    listeners,
    addEventListener: vi.fn((t: string, l: EventListener) => listeners.set(t, l)),
    removeEventListener: vi.fn((t: string) => listeners.delete(t)),
  };
}

beforeEach(() => usePrefsStore.setState({ ...DEFAULT_PREFS }));
afterEach(() => resetAudioForTests());

describe("audio engine (specs/game-audio)", () => {
  it("does nothing without Web Audio", () => {
    resetAudioForTests(() => null);
    expect(audioOutput()).toBeNull();
    expect(() => playSound("dice")).not.toThrow();
  });

  it("drops sounds while locked and plays after the first interaction", async () => {
    const { ctx, started } = fakeContext();
    resetAudioForTests(() => ctx);
    const target = fakeTarget();
    installAudioUnlock(target);
    playSound("chime");
    expect(started).toEqual([]);
    target.listeners.get("pointerdown")?.(new Event("pointerdown"));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.state).toBe("running");
    expect(target.listeners.size).toBe(0);
    expect(started).toEqual([]); // nothing queued from before the unlock
    playSound("chime");
    expect(started.filter((k) => k === "osc")).toHaveLength(2);
    playSound("dice");
    expect(started.filter((k) => k === "noise").length).toBeGreaterThan(5);
  });

  it("sets the master gain from the volume and follows changes", () => {
    const { ctx, gains } = fakeContext("running");
    resetAudioForTests(() => ctx);
    usePrefsStore.setState({ volume: 0.2 });
    expect(audioOutput()).not.toBeNull();
    const master = gains[0]!;
    expect(master.gain.value).toBe(0.2);
    setPref("volume", 0.35);
    expect(master.gain.value).toBe(0.35);
  });

  it("plays nothing while muted", () => {
    const { ctx, started } = fakeContext("running");
    resetAudioForTests(() => ctx);
    usePrefsStore.setState({ sound: false });
    playSound("dice");
    expect(started).toEqual([]);
  });
});

describe("prefs (specs/game-audio 'Mute setting')", () => {
  it("defaults to sound on, notifications off, 60 % volume, system motion", () => {
    expect(readPrefs(null)).toEqual({
      sound: true,
      notify: false,
      volume: 0.6,
      music: true,
      musicVolume: 0.3,
      motion: "system",
      wheel: "auto",
      graphicsMode: "realistic",
      graphicsQuality: "auto",
      avatar: null,
    });
  });

  it("keeps sound and notify from an old record and defaults the new fields", () => {
    const storage = {
      getItem: () => JSON.stringify({ sound: false, notify: true }),
      setItem: () => {},
    };
    expect(readPrefs(storage)).toEqual({
      sound: false,
      notify: true,
      volume: 0.6,
      music: true,
      musicVolume: 0.3,
      motion: "system",
      wheel: "auto",
      graphicsMode: "realistic",
      graphicsQuality: "auto",
      avatar: null,
    });
  });

  it("validates each field on its own", () => {
    const record = (r: object) => ({ getItem: () => JSON.stringify(r), setItem: () => {} });
    expect(readPrefs(record({ sound: "yes", volume: 0.35, motion: "reduce" }))).toEqual({
      sound: true,
      notify: false,
      volume: 0.35,
      music: true,
      musicVolume: 0.3,
      motion: "reduce",
      wheel: "auto",
      graphicsMode: "realistic",
      graphicsQuality: "auto",
      avatar: null,
    });
    expect(readPrefs(record({ volume: "loud", motion: "fast" }))).toEqual(DEFAULT_PREFS);
    expect(readPrefs(record({ volume: 7 })).volume).toBe(1);
    expect(readPrefs(record({ volume: -1 })).volume).toBe(0);
    expect(readPrefs(record({ volume: 0.33 })).volume).toBe(0.35);
  });

  it("round-trips through storage and ignores junk", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    const saved = {
      sound: false,
      notify: true,
      volume: 0.35,
      music: false,
      musicVolume: 0.55,
      motion: "full",
      wheel: "auto",
      graphicsMode: "realistic",
      graphicsQuality: "auto",
      avatar: "farmer",
    } as const;
    writePrefs(saved, storage);
    expect(readPrefs(storage)).toEqual(saved);
    data.set(PREFS_STORAGE_KEY, "{bad json");
    expect(readPrefs(storage)).toEqual(DEFAULT_PREFS);
  });

  it("keeps working when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readPrefs(storage)).toEqual(DEFAULT_PREFS);
    expect(() => writePrefs({ ...DEFAULT_PREFS, sound: false }, storage)).not.toThrow();
    setPref("sound", false);
    expect(usePrefsStore.getState().sound).toBe(false);
  });
});
