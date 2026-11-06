// Your-turn focus overlay (specs/game-hud "Your-turn focus"; hud-presentation "Minimal motion";
// design decision 8). The dice tray moves itself to the center above this overlay (z-40) while
// `ui.focus` is "open"; this component draws the dimmed backdrop, heading, countdown and
// "Not yet", announces the turn, marks the tab title while hidden and moves keyboard focus.
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { setTurnFocus, useUiStore } from "../store/ui.ts";
import { countdownText, useCountdown } from "./countdown.ts";
import { useLegal, useView } from "./state.ts";
import { useTurnFocus } from "./useTurnFocus.ts";

/** Prefix of `document.title` while the viewer's turn waits in a hidden tab. */
export const TITLE_MARK = "● ";

function unmarkTitle(): void {
  if (document.title.startsWith(TITLE_MARK)) {
    document.title = document.title.slice(TITLE_MARK.length);
  }
}

function markTitle(): void {
  if (!document.title.startsWith(TITLE_MARK)) document.title = TITLE_MARK + document.title;
}

const dismiss = () => setTurnFocus("dismissed");

/** Mount once while a game view is present (it also runs `useTurnFocus`). */
export function TurnFocus() {
  useTurnFocus();
  const focus = useUiStore((s) => s.focus);
  const open = focus === "open";
  const legal = useLegal();
  const view = useView();
  const countdown = useCountdown();
  const { t } = useTranslation();
  const openRef = useRef(open);

  // Tab title marker: set while the focus is open in a hidden tab, removed once it is shown.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) unmarkTitle();
      else if (openRef.current) markTitle();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      unmarkTitle();
    };
  }, []);
  useEffect(() => {
    openRef.current = open;
    if (open && document.hidden) markTitle();
  }, [open]);

  // Keyboard: focus moves to the dice on open and back to where it was on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLElement>('[data-testid="dice"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && previous.isConnected && previous !== document.body) previous.focus();
      else (document.activeElement as HTMLElement | null)?.blur?.();
    };
  }, [open]);

  const forOrder = legal?.rollForOrder === true;
  const viewer = view?.viewer ?? null;
  const own =
    countdown && countdown.kind === "roll" && viewer !== null && countdown.seats.includes(viewer)
      ? countdown
      : null;

  return (
    <div
      data-testid="turn-focus"
      data-open={open || undefined}
      aria-hidden={!open}
      onClick={(e) => {
        if (open && e.target === e.currentTarget) dismiss();
      }}
      className="pointer-events-none invisible fixed inset-0 z-30 bg-black/55 opacity-0 transition-[opacity,visibility] duration-200 motion-reduce:transition-none data-[open]:pointer-events-auto data-[open]:visible data-[open]:opacity-100"
    >
      {open && (
        <>
          <div role="alert" className="sr-only">
            {t("play.focus.yourTurn")}
          </div>
          <div className="pointer-events-none absolute inset-x-4 top-1/2 flex -translate-y-[calc(100%+6rem)] flex-col items-center gap-1 text-center text-white max-sm:-translate-y-[calc(100%+4.5rem)]">
            <h2 className="m-0 text-3xl font-bold drop-shadow-md max-sm:text-2xl">
              {forOrder ? t("play.focus.rollForOrder") : t("play.focus.yourTurn")}
            </h2>
            {own && (
              <p
                data-testid="focus-countdown"
                data-warning={own.warning || undefined}
                className="m-0 text-lg font-semibold tabular-nums drop-shadow-md data-[warning]:text-bad"
              >
                <span aria-hidden="true">{own.secondsLeft} s</span>
                <span className="sr-only">{countdownText(own.secondsLeft, t)}</span>
              </p>
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-4 top-1/2 flex translate-y-[6rem] justify-center max-sm:translate-y-[4.5rem]">
            <button
              type="button"
              onClick={dismiss}
              className="pointer-events-auto rounded-none px-3 py-1.5 text-base text-white underline underline-offset-4 outline-none hover:text-white/80 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("play.focus.notYet")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
