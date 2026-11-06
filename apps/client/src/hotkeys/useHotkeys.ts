// One global key listener (specs/keyboard-shortcuts). Each shortcut runs only when its button
// is enabled, using the same controls the buttons use.
import { useEffect, useRef } from "react";
import { controlsOf, showBuildControls } from "../game/status.ts";
import { act } from "../net/actions.ts";
import { openSettings, useSettingsStore } from "../settings/sections.ts";
import { chooseBuild, openDialog, openTrade, useUiStore } from "../store/ui.ts";
import { type ViewPreset, requestZoom, setViewPreset, useViewStore } from "../store/view.ts";
import { useInFlight, useLegal, useView } from "../hud/state.ts";
import { ignoreKey, modalOpen } from "./guards.ts";
import { type HotkeyId, matchHotkey } from "./registry.ts";

export const ZOOM_STEP = 15;
const VIEW_ORDER: readonly ViewPreset[] = ["free", "top", "diagonal"];

export function nextView(current: ViewPreset): ViewPreset {
  return VIEW_ORDER[(VIEW_ORDER.indexOf(current) + 1) % VIEW_ORDER.length]!;
}

type Run = (id: HotkeyId) => boolean;

/** Mount once while a game view is present. */
export function useHotkeys(): void {
  const view = useView();
  const legal = useLegal();
  const inFlight = useInFlight();

  const run = useRef<Run>(() => false);
  run.current = (id) => {
    if (id === "showHotkeys") {
      openSettings("keyboard");
      return true;
    }
    if (id === "zoomIn" || id === "zoomOut") {
      const zoom = useViewStore.getState().zoom;
      requestZoom(zoom + (id === "zoomIn" ? ZOOM_STEP : -ZOOM_STEP));
      return true;
    }
    if (id === "cycleView") {
      setViewPreset(nextView(useViewStore.getState().preset));
      return true;
    }
    if (!view || view.viewer === null) return false;
    const viewer = view.viewer;
    const c = controlsOf(view, legal, inFlight);
    if (id === "rollDice") {
      const action = c.rollForOrder ? "rollForOrder" : c.rollDice ? "rollDice" : null;
      return action !== null && (act({ type: action }), true);
    }
    // The other turn actions exist only for the active player after setup (ActionButtons).
    if (!showBuildControls(view, viewer)) return false;
    switch (id) {
      case "buildRoad":
      case "buildSettlement":
      case "buildCity": {
        const kind = id === "buildRoad" ? "road" : id === "buildSettlement" ? "settlement" : "city";
        const active = useUiStore.getState().build === kind;
        if (!active && !c[id]) return false;
        chooseBuild(active ? null : kind);
        return true;
      }
      case "buyDevCard":
        return c.buyDevCard && (act({ type: "buyDevCard" }), true);
      case "tradeBank":
        return c.maritime && (openDialog("maritime"), true);
      case "tradePlayers":
        if (!c.proposeTrade) return false;
        openTrade({
          give: {},
          get: {},
          to: view.players.map((_, i) => i).filter((s) => s !== viewer),
        });
        return true;
      case "endTurn":
        return c.endTurn && (act({ type: "endTurn" }), true);
      case "playKnight":
        return c.devCards.includes("knight") && (act({ type: "playKnight" }), true);
      default:
        return false;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e)) return;
      const hk = matchHotkey(e.key);
      if (!hk) return;
      if (modalOpen()) {
        // Only the shortcuts list may be shown from inside Settings.
        if (hk.id !== "showHotkeys" || !useSettingsStore.getState().open) return;
      }
      if (run.current(hk.id)) e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
