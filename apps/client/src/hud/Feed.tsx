// Event log, toasts, rejection message and game over (specs/game-hud).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { holdMusic } from "../audio/music.ts";
import { Button } from "@/components/ui/button.tsx";
import { SeatAvatar } from "./Avatar.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Dialog, DialogContent } from "@/components/ui/dialog.tsx";
import { seatColor, seatColorName } from "../game/colors.ts";
import { describe, toastFor } from "../game/describe.ts";
import { i18n } from "../i18n/index.ts";
import { backToStart } from "../net/actions.ts";
import { useGameStore } from "../store/game.ts";
import { useRoomStore } from "../store/room.ts";
import { dismissToast, pushToast, useUiStore } from "../store/ui.ts";
import { ruleErrorText } from "./errors.ts";
import { namesFrom, useNames } from "./names.ts";
import { Swatch } from "./PlayerPanels.tsx";
import { useView } from "./state.ts";

/** Pixels from the bottom that still count as "at the newest entry". */
const STICK_PX = 24;

/** Mount while a game view is present. Stays at the newest entry unless scrolled up. */
export function EventLog() {
  const { t } = useTranslation();
  const log = useGameStore((s) => s.log);
  const names = useNames();
  const ref = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <Card aria-label={t("dialogs.feed.log")} className="flex max-h-full min-h-0 flex-col p-3.5">
      <ol
        ref={ref}
        className="m-0 max-h-full min-h-0 flex-1 list-none overflow-y-auto px-1 py-0"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_PX;
        }}
      >
        {log.length === 0 && (
          <li data-testid="log-empty" className="px-1.5 py-[3px] text-muted-foreground">
            {t("dialogs.feed.empty")}
          </li>
        )}
        {log.map((event, i) => {
          const line = describe(event, names, t, log[i + 1]);
          const seat = line.seats[0];
          return (
            <li
              key={i}
              data-testid="log-line"
              data-type={event.type}
              className="border-l-[3px] border-transparent px-1.5 py-[3px] leading-snug"
              style={seat === undefined ? undefined : { borderLeftColor: seatColor(seat).hex }}
            >
              {line.text}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/**
 * Turns the events of each incremental update into toasts for the viewer.
 * Snapshots (join, resume) never toast. Call once (Toasts does).
 */
export function useEventToasts(): void {
  useEffect(
    () =>
      useGameStore.subscribe((s, prev) => {
        if (s.source !== "update" || s.lastEvents === prev.lastEvents) return;
        const viewer = s.view?.viewer ?? null;
        // Outside React: use the language shown right now.
        const t = i18n.t;
        const names = namesFrom(useRoomStore.getState().seats, t);
        s.lastEvents.forEach((e, i) => {
          const toast = toastFor(e, viewer, names, t, s.lastEvents[i + 1]);
          if (toast) pushToast(toast.text, toast.tone, undefined, toast.seat);
        });
      }),
    [],
  );
}

/** Always mounted. Toasts never block input. */
export function Toasts() {
  useEventToasts();
  const toasts = useUiStore((s) => s.toasts);
  return (
    <div className="flex flex-col items-end gap-1.5" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="toast"
          data-tone={t.tone}
          className="pointer-events-auto flex animate-fade-in items-center gap-2 rounded-none border-l-4 border-transparent paper px-3 py-2 backdrop-blur-sm data-[tone=bad]:border-bad data-[tone=good]:border-ok data-[tone=info]:border-wait"
        >
          {t.seat !== undefined && <SeatAvatar seat={t.seat} size="sm" />}
          <span>{t.text}</span>
          <DismissButton onClick={() => dismissToast(t.id)} />
        </div>
      ))}
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("dialogs.feed.dismiss")}
      onClick={onClick}
      className="size-6 text-base leading-none"
    >
      ×
    </Button>
  );
}

export const REJECTION_MS = 5000;

/** Always mounted; shows the last rule rejection for a few seconds. */
export function Rejection() {
  const { t } = useTranslation();
  const rejection = useGameStore((s) => s.rejection);
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    if (!rejection) return;
    const id = rejection.id;
    const t = setTimeout(() => setHidden(id), REJECTION_MS);
    return () => clearTimeout(t);
  }, [rejection]);
  if (!rejection || hidden === rejection.id) return null;
  return (
    <div
      role="alert"
      data-interactive
      className="pointer-events-auto flex animate-fade-in items-center gap-2 rounded-none border border-bad paper px-3 py-2 backdrop-blur-sm"
    >
      <span>{ruleErrorText(rejection.code, rejection.message, t)}</span>
      <code className="text-[11px] text-muted-foreground">{rejection.code}</code>
      <DismissButton onClick={() => setHidden(rejection.id)} />
    </div>
  );
}

/**
 * Always mounted; shows when the view has a winner, or when the host ended the game early
 * (room result: one or several winners, VP totals from the result).
 */
export function GameOver() {
  const { t } = useTranslation();
  const view = useView();
  const result = useRoomStore((s) => s.result);
  const names = useNames();
  const over = !!view && (view.winner !== null || result !== null);
  // The background music fades out while the scoreboard is up, and comes back after it.
  useEffect(() => {
    holdMusic(over);
    return () => holdMusic(false);
  }, [over]);
  if (!view || (view.winner === null && result === null)) return null;
  const winners = result ? result.winners : [view.winner as number];
  const w = seatColor(winners[0] ?? 0);
  const rows = (
    result
      ? result.scores.map((r) => ({ seat: r.seat, vp: r.vp, hidden: r.hiddenVp }))
      : view.players.map((p) => ({
          seat: p.seat,
          vp: p.publicVp + (p.hiddenVp ?? 0),
          hidden: p.hiddenVp ?? 0,
        }))
  ).sort((a, b) => b.vp - a.vp);
  const headline =
    winners.length === 1
      ? t("dialogs.feed.wins", { name: names(winners[0] as number) })
      : t("dialogs.feed.winTogether", {
          names: new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(
            winners.map((s) => names(s)),
          ),
        });
  // Not dismissable: the only way on is "Back to start".
  return (
    <Dialog open>
      <DialogContent
        aria-label={t("dialogs.feed.gameOver")}
        aria-labelledby={undefined}
        title={
          <span className="flex items-center gap-1.5">
            {winners.length === 1 && <Swatch hex={w.hex} name={w.name} />}
            {headline}
          </span>
        }
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {result && (
          <p className="text-sm text-muted-foreground" data-testid="ended-by-host">
            {t("dialogs.feed.endedByHost")}
          </p>
        )}
        <table className="mt-2 mb-3.5 w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className="px-1.5 py-1 text-left">
                {t("dialogs.feed.player")}
              </th>
              <th scope="col" className="px-1.5 py-1 text-left">
                {t("dialogs.feed.vp")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.seat}
                data-winner={winners.includes(r.seat) || undefined}
                className="data-[winner]:font-bold"
              >
                <td className="px-1.5 py-1">
                  <span className="mr-1.5 inline-block align-middle">
                    <Swatch hex={seatColor(r.seat).hex} name={seatColorName(r.seat, t)} />
                  </span>
                  {names(r.seat)}
                </td>
                <td className="px-1.5 py-1">
                  {r.vp}
                  {r.hidden > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      {t("dialogs.feed.hiddenVp", { count: r.hidden })}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button onClick={() => backToStart()}>{t("dialogs.feed.backToStart")}</Button>
      </DialogContent>
    </Dialog>
  );
}
