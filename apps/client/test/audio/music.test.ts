// Background music player (src/audio/music.ts): unlock, playlist order, switch, volume, visibility.
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  FADE_MS,
  PLAYLIST,
  currentTrack,
  holdMusic,
  installMusic,
  resetMusicForTests,
  type MusicElement,
} from "../../src/audio/music.ts";
import { DEFAULT_PREFS, readPrefs, setPref, usePrefsStore } from "../../src/store/prefs.ts";

type Listener = () => void;

/** Fake <audio>: play() resolves unless `blocked`; events are fired by hand. */
function fakeAudio() {
  const listeners = new Map<string, Listener[]>();
  const a = {
    src: "",
    volume: 1,
    currentTime: 0,
    paused: true,
    preload: "",
    blocked: false,
    plays: 0,
    play() {
      a.plays += 1;
      if (a.blocked) return Promise.reject(new Error("NotAllowedError"));
      a.paused = false;
      return Promise.resolve();
    },
    pause() {
      a.paused = true;
    },
    addEventListener(type: string, fn: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    fire(type: string) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
  };
  return a;
}

/** Fake document: records capture listeners so a test can "click". */
function fakeDoc() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    hidden: false,
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
    fire(type: string) {
      for (const fn of Array.from(listeners.get(type) ?? [])) fn();
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let audio: ReturnType<typeof fakeAudio>;
let doc: ReturnType<typeof fakeDoc>;

function install() {
  installMusic({
    createElement: () => audio as unknown as MusicElement,
    doc: doc as unknown as Document,
  });
}

beforeEach(() => {
  usePrefsStore.setState({ ...DEFAULT_PREFS });
  audio = fakeAudio();
  doc = fakeDoc();
});
afterEach(() => {
  resetMusicForTests();
  vi.useRealTimers();
});

describe("background music", () => {
  it("ships at least one track and defaults to on at 30 %", () => {
    expect(PLAYLIST.length).toBeGreaterThan(0);
    expect(PLAYLIST[0]!.src).toBe("/music/fertility.mp3");
    expect(PLAYLIST[0]!.gain).toBe(0.5);
    expect(DEFAULT_PREFS.music).toBe(true);
    expect(DEFAULT_PREFS.musicVolume).toBe(0.3);
  });

  it("waits for the first interaction, then plays the first track at the music volume", async () => {
    install();
    expect(audio.plays).toBe(0);
    doc.fire("pointerdown");
    await flush();
    expect(audio.src).toBe("/music/fertility.mp3");
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeCloseTo(0.3 * (PLAYLIST[0]!.gain ?? 1));
    expect(audio.preload).toBe("none");
    expect(doc.count("pointerdown")).toBe(0); // unlock listener removed once playing
  });

  it("retries on the next interaction when the browser still blocks playback", async () => {
    install();
    audio.blocked = true;
    doc.fire("keydown");
    await flush();
    expect(audio.paused).toBe(true);
    expect(doc.count("keydown")).toBe(1);
    audio.blocked = false;
    doc.fire("keydown");
    await flush();
    expect(audio.paused).toBe(false);
  });

  it("follows the switch and the volume slider", async () => {
    install();
    doc.fire("pointerdown");
    await flush();
    setPref("musicVolume", 0.55);
    expect(audio.volume).toBeCloseTo(0.55 * (PLAYLIST[0]!.gain ?? 1));
    setPref("music", false);
    expect(audio.paused).toBe(true);
    setPref("music", true);
    await flush();
    expect(audio.paused).toBe(false);
  });

  it("stays silent when music is off from the start", async () => {
    usePrefsStore.setState({ music: false });
    install();
    doc.fire("pointerdown");
    await flush();
    expect(audio.plays).toBe(0);
  });

  it("pauses while the tab is hidden and resumes when it is back", async () => {
    install();
    doc.fire("pointerdown");
    await flush();
    doc.hidden = true;
    doc.fire("visibilitychange");
    expect(audio.paused).toBe(true);
    doc.hidden = false;
    doc.fire("visibilitychange");
    await flush();
    expect(audio.paused).toBe(false);
  });

  it("starts the track again (or the next one) when it ends", async () => {
    install();
    doc.fire("pointerdown");
    await flush();
    audio.currentTime = 200;
    audio.paused = true;
    audio.fire("ended");
    await flush();
    const expected = PLAYLIST[1 % PLAYLIST.length]!;
    expect(currentTrack()).toEqual(expected);
    expect(audio.src).toBe(expected.src);
    if (PLAYLIST.length === 1) expect(audio.currentTime).toBe(0);
    expect(audio.paused).toBe(false);
  });

  it("does not loop forever when every track fails to load", async () => {
    install();
    doc.fire("pointerdown");
    await flush();
    const before = audio.plays;
    for (let i = 0; i < PLAYLIST.length + 2; i++) audio.fire("error");
    await flush();
    expect(audio.plays - before).toBeLessThanOrEqual(PLAYLIST.length);
  });

  it("fades out and pauses while held (game over), then plays again when released", async () => {
    install();
    doc.fire("pointerdown");
    await flush();
    const full = audio.volume;
    vi.useFakeTimers();
    holdMusic(true);
    expect(audio.paused).toBe(false); // fading, not cut
    vi.advanceTimersByTime(FADE_MS / 2);
    expect(audio.volume).toBeLessThan(full);
    expect(audio.volume).toBeGreaterThan(0);
    vi.advanceTimersByTime(FADE_MS);
    expect(audio.volume).toBe(0);
    expect(audio.paused).toBe(true);
    setPref("musicVolume", 0.8); // settings changes do not restart it while held
    expect(audio.paused).toBe(true);
    holdMusic(false);
    vi.useRealTimers();
    await flush();
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeCloseTo(0.8 * (PLAYLIST[0]!.gain ?? 1));
  });

  it("releasing mid-fade cancels the fade and keeps playing at full volume", async () => {
    install();
    doc.fire("pointerdown");
    await flush();
    const full = audio.volume;
    vi.useFakeTimers();
    holdMusic(true);
    vi.advanceTimersByTime(FADE_MS / 4);
    holdMusic(false);
    vi.advanceTimersByTime(FADE_MS * 2);
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeCloseTo(full);
  });

  it("stores the music choice with the other preferences", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    storage.setItem("hexfall.prefs", JSON.stringify({ music: false, musicVolume: 0.42 }));
    expect(readPrefs(storage)).toMatchObject({ music: false, musicVolume: 0.4 });
    storage.setItem("hexfall.prefs", JSON.stringify({ music: "yes", musicVolume: "loud" }));
    expect(readPrefs(storage)).toMatchObject({ music: true, musicVolume: 0.3 });
  });
});
