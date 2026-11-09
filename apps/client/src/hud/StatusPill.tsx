// Floating turn status (specs/game-hud "Turn status and controls", "Turn countdown"; design
// decision 6): what the game waits for, the build-pick prompt with Cancel, and the viewer's own
// countdown while they owe a setup placement, a robber move or free roads.
import type { PlayerView, Seat } from "@hexfall/engine";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { currentPick } from "../game/pick.ts";
import { statusOf } from "../game/status.ts";
import { chooseBuild, useUiStore } from "../store/ui.ts";
import { CountdownText } from "./actions/CountdownText.tsx";
import { WARNING_SECONDS, countdownText, useCountdown } from "./countdown.ts";
import { useNames } from "./names.ts";
import { HelpMark } from "./tutorial/TutorialHelp.tsx";
import { useInFlight, useLegal, useView } from "./state.ts";

/** Waits whose own countdown shows in the pill (roll: dice; turn: End turn; discard: dialog). */
const PILL_PHASES: ReadonlySet<PlayerView["phase"]["kind"]> = new Set([
  "setup",
  "moveRobber",
  "roadBuilding",
  "specialBuild",
]);

const waitedOn = (seats: readonly Seat[], viewer: Seat | null) =>
  viewer !== null && seats.includes(viewer);

/** Mount while a game view is present. */
export function StatusPill() {
  const view = useView();
  const legal = useLegal();
  const inFlight = useInFlight();
  const names = useNames();
  const build = useUiStore((s) => s.build);
  const victimHex = useUiStore((s) => s.victimHex);
  const countdown = useCountdown();
  const { t } = useTranslation();
  if (!view) return null;
  const status = statusOf(view, names, t);
  const pick = currentPick({ view, legal, build, inFlight, victimHex });
  const picking = build !== null && pick !== null;
  const own =
    countdown &&
    countdown.kind === "action" &&
    PILL_PHASES.has(view.phase.kind) &&
    waitedOn(countdown.seats, view.viewer)
      ? countdown
      : null;
  return (
    <div
      data-testid="status-pill"
      className="pointer-events-none flex w-max max-w-full flex-col items-start gap-1.5"
    >
      <div className="flex max-w-full items-center gap-2 rounded-full border border-[#c9a04e]/40 bg-[#2a160b]/75 px-4 py-1.5 text-sm text-[#f6ecd0] shadow-sm shadow-black/20 backdrop-blur-sm">
        <p
          data-testid="turn-status"
          data-your-move={status.yourMove || undefined}
          role="status"
          className="m-0 text-center font-semibold data-[your-move]:text-[#f0c860]"
        >
          {status.text}
        </p>
        {view.phase.kind === "moveRobber" && status.yourMove && (
          <HelpMark topic="robber" className="pointer-events-auto ml-0" />
        )}
        {own && <CountdownText countdown={own} />}
        <span
          data-testid="goal-chip"
          title={t("play.panels.goalHint", { count: view.victoryTarget })}
          className="pointer-events-auto ml-1 shrink-0 border-l border-[#c9a04e]/40 pl-2.5 text-xs font-semibold whitespace-nowrap text-[#f0c860]"
        >
          {t("play.panels.goal", { count: view.victoryTarget })}
        </span>
      </div>
      {picking && (
        <p
          className="pointer-events-auto m-0 flex items-center gap-2 rounded-full border border-[#c9a04e]/40 bg-[#2a160b]/75 px-3 py-0.5 text-xs text-[#f6ecd0] shadow-sm shadow-black/20 backdrop-blur-sm"
          role="status"
        >
          {t("play.pill.pickSpot")}
          <Button variant="link" size="sm" onClick={() => chooseBuild(null)}>
            {t("play.pill.cancel")}
          </Button>
        </p>
      )}
    </div>
  );
}

/**
 * Polite announcement of the viewer's own countdown, once, when it crosses 10 seconds left
 * (specs/game-hud "Turn countdown", "Last seconds"). A countdown that starts below 10 s (a
 * resume) is not announced, and later messages within the same wait do not repeat it.
 */
export function CountdownAnnouncer() {
  const viewer = useView()?.viewer ?? null;
  const countdown = useCountdown();
  const mine = countdown !== null && waitedOn(countdown.seats, viewer);
  const seconds = mine ? countdown.secondsLeft : null;
  const prev = useRef<number | null>(null);
  const [text, setText] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    const before = prev.current;
    prev.current = seconds;
    if (seconds === null || seconds > WARNING_SECONDS) {
      setText("");
      return;
    }
    if (seconds > 0 && before !== null && before > WARNING_SECONDS) {
      setText(countdownText(seconds, t));
    }
  }, [seconds, t]);

  return (
    <div role="status" aria-live="polite" className="sr-only" data-testid="countdown-announce">
      {text}
    </div>
  );
}
