// Which game events play which sound effect. Add a line to EVENT_SOUNDS to give another event a
// sound. Turn chimes and the dice rattle stay in alerts/useGameAlerts.ts (they follow waits).
import type { GameEvent } from "@hexfall/engine";
import type { SoundName } from "./sounds.ts";

type EventOf<T extends GameEvent["type"]> = Extract<GameEvent, { type: T }>;

const BUILD_SOUND: Record<EventOf<"built">["piece"], SoundName> = {
  road: "buildRoad",
  settlement: "buildSettlement",
  city: "buildCity",
};

const EVENT_SOUNDS: { [T in GameEvent["type"]]?: (e: EventOf<T>) => SoundName | null } = {
  built: (e) => BUILD_SOUND[e.piece],
};

/** The sounds for one batch of events, each played once (Road Building's two roads: one sound). */
export function soundsForEvents(events: readonly GameEvent[]): SoundName[] {
  const out = new Set<SoundName>();
  for (const e of events) {
    const pick = EVENT_SOUNDS[e.type] as ((e: GameEvent) => SoundName | null) | undefined;
    const name = pick?.(e);
    if (name) out.add(name);
  }
  return [...out];
}
