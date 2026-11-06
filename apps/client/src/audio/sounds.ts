// Turn chime and dice rattle, synthesized with Web Audio (specs/game-audio). No files.
import { usePrefsStore } from "../store/prefs.ts";
import { audioOutput } from "./engine.ts";

export type SoundName = "chime" | "dice" | "turnSoft";

/** Rattle length in seconds: a bit under the dice throw (DiceTray THROW_MS = 980). */
export const RATTLE_S = 0.9;

/** Two soft notes (E5 → A5), under one second. */
function chime(ctx: AudioContext, out: AudioNode): void {
  const t0 = ctx.currentTime + 0.01;
  const notes: [number, number][] = [
    [659.25, 0],
    [880, 0.14],
  ];
  for (const [freq, at] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = t0 + at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.65);
  }
}

/** One quiet, short note (A4) when the turn passes to someone else: less important than the chime. */
function turnSoft(ctx: AudioContext, out: AudioNode): void {
  const start = ctx.currentTime + 0.01;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 440;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + 0.4);
}

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function noise(ctx: AudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    const len = Math.floor(ctx.sampleRate * 0.05);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

/** Clicks of band-passed noise over the throw, quieter and sparser as the dice settle. */
function diceRattle(ctx: AudioContext, out: AudioNode): void {
  const t0 = ctx.currentTime + 0.01;
  const span = RATTLE_S;
  const hits = 10;
  const buf = noise(ctx);
  for (let i = 0; i < hits; i++) {
    const p = i / (hits - 1);
    // Ease-out spacing: hits bunch at the start, spread out as the dice slow down.
    const at = t0 + span * (1 - (1 - p) ** 1.8) + (Math.random() - 0.5) * 0.02;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1800 + Math.random() * 1600;
    band.Q.value = 4;
    const gain = ctx.createGain();
    const peak = 0.9 * (1 - p * 0.75);
    gain.gain.setValueAtTime(peak, Math.max(at, t0));
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(at, t0) + 0.045);
    src.connect(band).connect(gain).connect(out);
    src.start(Math.max(at, t0));
    src.stop(Math.max(at, t0) + 0.05);
  }
}

const SOUNDS: Record<SoundName, (ctx: AudioContext, out: AudioNode) => void> = {
  chime,
  dice: diceRattle,
  turnSoft,
};

/** Plays a sound now, or does nothing when muted, unsupported or still locked. Never throws. */
export function playSound(name: SoundName): void {
  if (!usePrefsStore.getState().sound) return;
  const audio = audioOutput();
  if (!audio) return;
  try {
    SOUNDS[name](audio.ctx, audio.out);
  } catch {
    // A sound must never break the game.
  }
}
