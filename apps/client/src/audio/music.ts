// Background music: a playlist of tracks under /public/music, streamed through one <audio>
// element (files are minutes long, so they are not decoded into memory like sound effects).
// Music has its own switch and volume, separate from game sounds. Browsers block autoplay, so
// it starts on the first pointer or key interaction; it pauses while the tab is hidden, and fades
// out while the game-over screen is up (holdMusic).
import { usePrefsStore } from "../store/prefs.ts";

export interface Track {
  src: string;
  title: string;
  artist: string;
  /** This track's loudness relative to the music volume, 0..1 (default 1), to even out songs. */
  gain?: number;
}

/** Played in order, then from the start again. Add a song: drop the file in /public/music. */
export const PLAYLIST: readonly Track[] = [
  { src: "/music/fertility.mp3", title: "Fertility", artist: "Syouki Takahashi", gain: 0.5 },
];

/** The parts of HTMLAudioElement the player uses (tests pass a fake). */
export interface MusicElement {
  src: string;
  volume: number;
  currentTime: number;
  paused: boolean;
  preload: string;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: "ended" | "error" | "playing", fn: () => void): void;
}

export interface MusicDeps {
  createElement: () => MusicElement | null;
  doc: Pick<Document, "addEventListener" | "removeEventListener" | "hidden"> | null;
}

function defaultDeps(): MusicDeps {
  return {
    createElement: () => {
      if (typeof globalThis.Audio !== "function") return null;
      try {
        return new Audio();
      } catch {
        return null;
      }
    },
    doc: globalThis.document ?? null,
  };
}

const UNLOCK_EVENTS = ["pointerdown", "keydown"] as const;

let deps: MusicDeps | null = null;
let el: MusicElement | null = null;
let index = 0;
let unlocked = false;
let failures = 0;
let unsubPrefs: (() => void) | null = null;
/** Bumped on every play request, so a late rejection of an old one is ignored. */
let attempt = 0;
/** Held silent by the game (game over); released when that screen goes away. */
let held = false;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

/** Fade-out length when the music is held, in ms. */
export const FADE_MS = 2000;
const FADE_STEPS = 20;

/** Index of the track playing (or next to play), for the settings "now playing" line. */
export function currentTrack(): Track | null {
  return PLAYLIST[index] ?? null;
}

function wanted(): boolean {
  const { music } = usePrefsStore.getState();
  return music && unlocked && !held && !deps?.doc?.hidden && PLAYLIST.length > 0;
}

function stopFade(): void {
  if (fadeTimer !== null) clearInterval(fadeTimer);
  fadeTimer = null;
}

/** Lowers the volume to silence over FADE_MS, then pauses. */
function fadeOut(e: MusicElement): void {
  if (fadeTimer !== null) return;
  const from = e.volume;
  let step = 0;
  fadeTimer = setInterval(() => {
    step += 1;
    e.volume = Math.max(0, from * (1 - step / FADE_STEPS));
    if (step >= FADE_STEPS) {
      stopFade();
      e.pause();
    }
  }, FADE_MS / FADE_STEPS);
}

/** Silences the music (fading out) while `on`, e.g. while the game-over screen is up. */
export function holdMusic(on: boolean): void {
  if (held === on) return;
  held = on;
  sync();
}

function element(): MusicElement | null {
  if (el || !deps) return el;
  el = deps.createElement();
  if (!el) return null;
  el.preload = "none";
  el.addEventListener("ended", () => advance());
  el.addEventListener("playing", () => {
    failures = 0;
  });
  el.addEventListener("error", () => {
    // A missing or broken file: try the next one, but stop once every track has failed.
    failures += 1;
    if (failures < PLAYLIST.length) advance();
  });
  return el;
}

function load(e: MusicElement, i: number): void {
  const track = PLAYLIST[i];
  if (!track) return;
  if (e.src.endsWith(track.src)) e.currentTime = 0;
  else e.src = track.src;
}

function advance(): void {
  if (PLAYLIST.length === 0) return;
  index = (index + 1) % PLAYLIST.length;
  const e = element();
  if (!e) return;
  load(e, index);
  sync();
}

/** Plays or pauses to match the switch, the unlock and the tab visibility. Never throws. */
function sync(): void {
  const e = element();
  if (!e) return;
  if (held && !e.paused) return fadeOut(e);
  stopFade();
  e.volume = usePrefsStore.getState().musicVolume * (PLAYLIST[index]?.gain ?? 1);
  if (!wanted()) {
    if (!e.paused) e.pause();
    return;
  }
  if (!e.src) load(e, index);
  if (!e.paused) return;
  const mine = ++attempt;
  try {
    void e.play().then(
      () => stopUnlock(),
      () => {
        // Still blocked by the browser: wait for the next interaction.
        if (mine === attempt) unlocked = false;
      },
    );
  } catch {
    unlocked = false;
  }
}

function onInteraction(): void {
  unlocked = true;
  sync();
}

function stopUnlock(): void {
  const doc = deps?.doc;
  if (!doc) return;
  for (const ev of UNLOCK_EVENTS) doc.removeEventListener(ev, onInteraction, true);
}

/** Starts the player: listens for the unlock, tab visibility and the music settings. */
export function installMusic(next: MusicDeps = defaultDeps()): void {
  if (deps) return;
  deps = next;
  const doc = deps.doc;
  if (doc) {
    for (const ev of UNLOCK_EVENTS) doc.addEventListener(ev, onInteraction, true);
    doc.addEventListener("visibilitychange", sync);
  }
  unsubPrefs = usePrefsStore.subscribe((s, prev) => {
    if (s.music !== prev.music || s.musicVolume !== prev.musicVolume) sync();
  });
}

/** Tests: stop and forget the player. */
export function resetMusicForTests(): void {
  stopUnlock();
  deps?.doc?.removeEventListener("visibilitychange", sync);
  unsubPrefs?.();
  unsubPrefs = null;
  stopFade();
  el?.pause();
  held = false;
  deps = null;
  el = null;
  index = 0;
  unlocked = false;
  failures = 0;
  attempt = 0;
}
