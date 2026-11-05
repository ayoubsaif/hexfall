// Sounds and turn alerts for the current game (openspec change turn-sound-and-push).
// Renders nothing; mount once while a game view is present.
import { useGameAlerts } from "../alerts/useGameAlerts.ts";
import { showLocalTurnNotice } from "../notify/local.ts";

const handlers = {
  onWaitStart: (kind: Parameters<typeof showLocalTurnNotice>[0]) => void showLocalTurnNotice(kind),
};

export function GameAlerts() {
  useGameAlerts(handlers);
  return null;
}
