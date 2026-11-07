// Sound effects for game actions (builds, see audio/eventSounds.ts). Renders nothing; mount once
// while a game view is present. Like GameAlerts it reacts to store writes, so each server update
// sounds exactly once and a snapshot (reconnect, page load) stays silent.
import { useEffect } from "react";
import { soundsForEvents } from "../audio/eventSounds.ts";
import { playSound, preloadSounds } from "../audio/sounds.ts";
import { useGameStore } from "../store/game.ts";

export function GameSounds() {
  useEffect(() => {
    preloadSounds();
    return useGameStore.subscribe((s, prev) => {
      if (s.source !== "update" || s.lastEvents === prev.lastEvents) return;
      for (const name of soundsForEvents(s.lastEvents)) playSound(name);
    });
  }, []);
  return null;
}
