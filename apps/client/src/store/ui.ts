import type { HexId, PlayerView, ResourceBundle, Seat } from "@hexfall/engine";
import { create } from "zustand";
import { useGameStore } from "./game.ts";

/** A paid build the player chose in the HUD; it starts the matching board pick. */
export type BuildChoice = "road" | "settlement" | "city";

export type DialogKind = "yearOfPlenty" | "monopoly" | "maritime" | "trade";

/** Prefill for the player-trade composer (specs/player-trade "Offer composer"). */
export interface TradeDraft {
  /** Changes on every open, so the composer starts fresh from this draft. */
  id: number;
  give: ResourceBundle;
  get: ResourceBundle;
  /** Recipients. Fixed to the active player when the viewer is not active. */
  to: Seat[];
}

export type ToastTone = "info" | "good" | "bad";

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

/** Your-turn focus (game-hud "Your-turn focus"): closed, open, or dismissed for this wait. */
export type TurnFocusState = "closed" | "open" | "dismissed";

/** Tab shown in the log drawer (game-hud "Log drawer tabs"). */
export type LogTab = "log" | "dice";

export interface UiState {
  build: BuildChoice | null;
  /** Robber hex chosen while the player picks between several victims. */
  victimHex: HexId | null;
  dialog: DialogKind | null;
  /** Set while the trade composer is open. */
  tradeDraft: TradeDraft | null;
  toasts: Toast[];
  focus: TurnFocusState;
  /** Last tab selected in the log drawer; it reopens on this tab. */
  logTab: LogTab;
}

export const initialUiState: UiState = {
  build: null,
  victimHex: null,
  dialog: null,
  tradeDraft: null,
  toasts: [],
  focus: "closed",
  logTab: "log",
};

/**
 * Player intent only (never server truth). Components may write it through
 * the helpers below. Intent is cleared whenever the server moves the game to
 * another phase or turn, so it never outlives the situation it was made in.
 */
export const useUiStore = create<UiState>()(() => ({ ...initialUiState }));

export function resetUi(): void {
  useUiStore.setState({ ...initialUiState }, true);
}

export function clearIntent(): void {
  useUiStore.setState({ build: null, victimHex: null, dialog: null, tradeDraft: null });
}

export function chooseBuild(build: BuildChoice | null): void {
  useUiStore.setState({ build, victimHex: null, dialog: null, tradeDraft: null });
}

export function setTurnFocus(focus: TurnFocusState): void {
  useUiStore.setState({ focus });
}

export function setLogTab(logTab: LogTab): void {
  useUiStore.setState({ logTab });
}

export function setVictimHex(victimHex: HexId | null): void {
  useUiStore.setState({ victimHex });
}

export function openDialog(dialog: DialogKind | null): void {
  useUiStore.setState({ dialog, build: null, tradeDraft: null });
}

let draftId = 0;

/** Opens the player-trade composer with a prefill. */
export function openTrade(draft: Omit<TradeDraft, "id">): void {
  useUiStore.setState({
    dialog: "trade",
    build: null,
    tradeDraft: { ...draft, to: [...draft.to], id: ++draftId },
  });
}

let toastId = 0;
export const TOAST_MS = 4000;
const MAX_TOASTS = 5;

/** Adds a toast; it closes on its own after `TOAST_MS`. Returns its id. */
export function pushToast(text: string, tone: ToastTone = "info", ms = TOAST_MS): number {
  const id = ++toastId;
  useUiStore.setState((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-MAX_TOASTS) }));
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id: number): void {
  useUiStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

/** The part of a view that, when it changes, makes any pending intent stale. */
export function intentKey(view: PlayerView | null): string {
  if (!view) return "none";
  const p = view.phase;
  const sub =
    p.kind === "setup"
      ? `${p.index}:${p.step}`
      : p.kind === "roadBuilding"
        ? String(p.remaining)
        : "";
  return `${p.kind}:${sub}:${view.turn.seat}:${view.turn.number}`;
}

/** Clears intent whenever the game store's view changes phase or turn. Returns an unsubscribe. */
export function bindUiToGame(game = useGameStore): () => void {
  let key = intentKey(game.getState().view);
  return game.subscribe((s) => {
    const next = intentKey(s.view);
    if (next !== key) {
      key = next;
      clearIntent();
    }
  });
}
