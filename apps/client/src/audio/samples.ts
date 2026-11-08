// Recorded sound effects (files under /public/sounds), decoded once per AudioContext and played
// through the shared master gain, so the sound switch and volume apply as for synthesized sounds.

/** Every sound file the game uses. */
export const SAMPLE_URLS = {
  build: "/sounds/build.mp3",
  burn: "/sounds/burn.mp3",
} as const;

export type SampleName = keyof typeof SAMPLE_URLS;

/** A sound still loading after this long is skipped: late audio feels unrelated to the action. */
export const LATE_MS = 400;

const decoded = new WeakMap<AudioContext, Map<SampleName, Promise<AudioBuffer | null>>>();
const ready = new WeakMap<AudioContext, Map<SampleName, AudioBuffer>>();

function readyMap(ctx: AudioContext): Map<SampleName, AudioBuffer> {
  let m = ready.get(ctx);
  if (!m) ready.set(ctx, (m = new Map()));
  return m;
}

/** Fetches and decodes a sample once; resolves to null when it cannot be loaded. */
export function loadSample(ctx: AudioContext, name: SampleName): Promise<AudioBuffer | null> {
  let m = decoded.get(ctx);
  if (!m) decoded.set(ctx, (m = new Map()));
  let p = m.get(name);
  if (!p) {
    p = fetch(SAMPLE_URLS[name])
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then(
        (buf) => {
          readyMap(ctx).set(name, buf);
          return buf;
        },
        () => null,
      );
    m.set(name, p);
  }
  return p;
}

export interface SampleOptions {
  /** Loudness relative to the master volume, 0..1 (default 1). */
  gain?: number;
  /** Playback speed; above 1 is shorter and higher (default 1). */
  rate?: number;
}

function start(ctx: AudioContext, out: AudioNode, buf: AudioBuffer, o: SampleOptions): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = o.rate ?? 1;
  const gain = ctx.createGain();
  gain.gain.value = o.gain ?? 1;
  src.connect(gain).connect(out);
  src.start();
}

/** Plays a sample now if decoded, else once it loads (unless that takes longer than LATE_MS). */
export function playSample(
  ctx: AudioContext,
  out: AudioNode,
  name: SampleName,
  o: SampleOptions = {},
): void {
  const buf = readyMap(ctx).get(name);
  if (buf) return start(ctx, out, buf, o);
  const asked = performance.now();
  void loadSample(ctx, name).then((b) => {
    if (b && performance.now() - asked <= LATE_MS) start(ctx, out, b, o);
  });
}
