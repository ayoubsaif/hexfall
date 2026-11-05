// One shared AudioContext for every game sound (openspec change turn-sound-and-push;
// specs/game-audio "Synthesized sounds", "Audio unlock"). Created lazily; resumed on the
// first pointer or key interaction; a sound asked for while audio is locked is dropped. The
// master gain follows the volume preference (specs/client-settings "Sound section").
import { usePrefsStore } from "../store/prefs.ts";

export type AudioContextFactory = () => AudioContext | null;

function defaultFactory(): AudioContext | null {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

let factory: AudioContextFactory = defaultFactory;
let ctx: AudioContext | null | undefined;
let master: GainNode | null = null;
let unsubVolume: (() => void) | null = null;
let unlockTarget: Pick<Document, "addEventListener" | "removeEventListener"> | null = null;

function context(): AudioContext | null {
  if (ctx === undefined) {
    ctx = factory();
    if (ctx) {
      const gain = ctx.createGain();
      master = gain;
      gain.gain.value = usePrefsStore.getState().volume;
      gain.connect(ctx.destination);
      unsubVolume = usePrefsStore.subscribe((s, prev) => {
        if (s.volume !== prev.volume) gain.gain.value = s.volume;
      });
    }
  }
  return ctx;
}

const UNLOCK_EVENTS = ["pointerdown", "keydown"] as const;

function onInteraction(): void {
  const c = context();
  if (!c) return stopUnlock();
  if (c.state === "running") return stopUnlock();
  void c.resume().then(
    () => {
      if (c.state === "running") stopUnlock();
    },
    () => {},
  );
}

function stopUnlock(): void {
  if (!unlockTarget) return;
  for (const e of UNLOCK_EVENTS) unlockTarget.removeEventListener(e, onInteraction, true);
  unlockTarget = null;
}

/** Starts listening for the first interaction that may unlock audio. Safe to call twice. */
export function installAudioUnlock(
  target: Pick<Document, "addEventListener" | "removeEventListener"> | null = globalThis.document ??
    null,
): void {
  if (!target || unlockTarget) return;
  unlockTarget = target;
  for (const e of UNLOCK_EVENTS) target.addEventListener(e, onInteraction, true);
}

/** The context and output node when audio may play now, else null (missing or still locked). */
export function audioOutput(): { ctx: AudioContext; out: AudioNode } | null {
  const c = context();
  if (!c || !master || c.state !== "running") return null;
  return { ctx: c, out: master };
}

/** Resumes the context now (from a user gesture, e.g. "Test sound"); true when audio can play. */
export async function resumeAudio(): Promise<boolean> {
  const c = context();
  if (!c) return false;
  if (c.state !== "running") {
    try {
      await c.resume();
    } catch {
      return false;
    }
  }
  if (c.state === "running") stopUnlock();
  return c.state === "running";
}

/** Tests: swap the context factory and forget the current context. */
export function resetAudioForTests(next: AudioContextFactory = defaultFactory): void {
  stopUnlock();
  unsubVolume?.();
  unsubVolume = null;
  factory = next;
  ctx = undefined;
  master = null;
}
