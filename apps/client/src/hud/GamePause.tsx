// Host pause / end controls and the paused notice (openspec change pause-and-resume-games:
// specs game-pause "Pause controls in the HUD", "Paused screen"; early-end "End control").
import { Flag, Pause } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog.tsx";
import { endGame, pauseGame, resumeGame } from "../net/actions.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useRoomStore } from "../store/room.ts";
import { roomErrorText } from "./errors.ts";

/** A paused room is kept this long after the pause (server PAUSED_TTL_MS). */
export const PAUSED_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/** Date and time in the viewer's language. */
export function formatDate(ms: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(ms);
}

const useIsHost = () => useRoomStore((s) => s.seat !== null && s.seat === s.host);

/** The error of the last pause/resume/end request, as text, or null. */
function useRequestError(): string | null {
  const { t } = useTranslation();
  const error = useRoomStore((s) => s.error);
  if (
    !error ||
    (error.request !== "pause" && error.request !== "resume" && error.request !== "end")
  ) {
    return null;
  }
  return roomErrorText(error.code, error.message, t);
}

/**
 * Confirmation before ending the game early. By default it ends the game this client sits
 * in (`endGame`); the saved games list passes its own `onConfirm`, `busy` and `error`.
 */
export function EndGameConfirm({
  open,
  onOpenChange,
  onConfirm,
  busy,
  error: errorOverride,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const pending = useRoomStore((s) => s.pending);
  const online = useConnectionStore((s) => s.status === "open");
  const requestError = useRequestError();
  const error = onConfirm ? (errorOverride ?? null) : requestError;
  const waiting = onConfirm ? (busy ?? false) : pending !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("session.pause.confirmEnd")} data-testid="end-confirm">
        <p className="text-sm">{t("session.pause.confirmEndText")}</p>
        {error && (
          <p className="mt-2 text-bad" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("session.pause.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!online || waiting}
            onClick={() => (onConfirm ? onConfirm() : endGame())}
          >
            {t("session.pause.endNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MenuStep = "menu" | "pause" | "end" | null;

/**
 * Host-only "Game" button for the HUD corner while the game runs: "Close game for now"
 * (pause) and "End game now", each behind a confirmation.
 */
export function HostGameMenu() {
  const { t } = useTranslation();
  const isHost = useIsHost();
  const playing = useRoomStore((s) => s.status === "playing");
  const pending = useRoomStore((s) => s.pending);
  const online = useConnectionStore((s) => s.status === "open");
  const error = useRequestError();
  const [step, setStep] = useState<MenuStep>(null);
  if (!isHost || !playing) return null;
  const close = (open: boolean) => {
    if (!open) setStep(null);
  };
  const label = t("session.pause.menu");
  return (
    <>
      <button
        type="button"
        data-testid="game-menu-button"
        data-interactive
        aria-label={label}
        aria-haspopup="dialog"
        title={label}
        className="pointer-events-auto grid size-[42px] cursor-pointer place-items-center rounded-full bg-hud text-hud-fg shadow-lg shadow-black/25 backdrop-blur-md transition-colors duration-150 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-ring max-sm:size-[46px] short:size-[46px] motion-reduce:transition-none"
        onClick={() => setStep("menu")}
      >
        <Pause aria-hidden size={18} />
      </button>
      <Dialog open={step === "menu"} onOpenChange={close}>
        <DialogContent title={t("session.pause.menuTitle")} data-testid="game-menu">
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="justify-start" onClick={() => setStep("pause")}>
              <Pause aria-hidden />
              <span className="flex flex-col items-start text-left">
                <span>{t("session.pause.closeForNow")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("session.pause.closeForNowHint")}
                </span>
              </span>
            </Button>
            <Button variant="secondary" className="justify-start" onClick={() => setStep("end")}>
              <Flag aria-hidden />
              <span className="flex flex-col items-start text-left">
                <span>{t("session.pause.endNow")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("session.pause.endNowHint")}
                </span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={step === "pause"} onOpenChange={close}>
        <DialogContent title={t("session.pause.confirmClose")} data-testid="pause-confirm">
          <p className="text-sm">{t("session.pause.confirmCloseText")}</p>
          {error && (
            <p className="mt-2 text-bad" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setStep(null)}>
              {t("session.pause.cancel")}
            </Button>
            <Button disabled={!online || pending !== null} onClick={() => pauseGame()}>
              {t("session.pause.closeForNow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EndGameConfirm open={step === "end"} onOpenChange={close} />
    </>
  );
}

/**
 * Full-screen notice while the room is paused: who paused, until when the game is kept,
 * and (host only) Resume / End game. The board stays visible behind it.
 */
export function PausedNotice() {
  const { t, i18n } = useTranslation();
  const pausedAt = useRoomStore((s) => (s.status === "paused" ? s.pausedAt : null));
  const paused = useRoomStore((s) => s.status === "paused");
  const isHost = useIsHost();
  const pending = useRoomStore((s) => s.pending);
  const online = useConnectionStore((s) => s.status === "open");
  const error = useRequestError();
  const [ending, setEnding] = useState(false);
  if (!paused) return null;
  const until = formatDate((pausedAt ?? Date.now()) + PAUSED_KEEP_MS, i18n.language);
  return (
    <>
      <Dialog open>
        <DialogContent
          title={t("session.pause.pausedTitle")}
          data-testid="paused-notice"
          role="alertdialog"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <p className="text-sm">{t("session.pause.pausedText", { date: until })}</p>
          {!isHost && (
            <p className="mt-2 text-sm text-muted-foreground">{t("session.pause.waitingHost")}</p>
          )}
          {error && (
            <p className="mt-2 text-bad" role="alert">
              {error}
            </p>
          )}
          {isHost && (
            <DialogFooter>
              <Button
                variant="secondary"
                disabled={!online || pending !== null}
                onClick={() => setEnding(true)}
              >
                {t("session.pause.end")}
              </Button>
              <Button disabled={!online || pending !== null} onClick={() => resumeGame()}>
                {t("session.pause.resume")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      {isHost && <EndGameConfirm open={ending} onOpenChange={setEnding} />}
    </>
  );
}
