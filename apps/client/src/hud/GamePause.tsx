// The in-game menu and the paused notice (openspec changes pause-and-resume-games: specs
// game-pause "Pause controls in the HUD", "Paused screen", early-end "End control";
// leave-running-game: spec leave-game "Game menu for every player").
import { gameIcon } from "./GameIcon.tsx";

const Flag = gameIcon("flag");
const Pause = gameIcon("pause");
const Leave = gameIcon("leave");
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog.tsx";
import { endGame, leaveRoom, pauseGame, resumeGame } from "../net/actions.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useRoomStore } from "../store/room.ts";
import { roomErrorText } from "./errors.ts";
import { inviteLinkFor } from "./Lobby.tsx";
import { inputClass } from "./StartScreen.tsx";

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

/** The error of the last leave request, as text, or null. */
function useLeaveError(): string | null {
  const { t } = useTranslation();
  const error = useRoomStore((s) => s.error);
  if (!error || error.request !== "leave") return null;
  return roomErrorText(error.code, error.message, t);
}

/** Confirmation before leaving a running game: a bot takes the seat, which others can claim. */
export function LeaveGameConfirm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const pending = useRoomStore((s) => s.pending);
  const online = useConnectionStore((s) => s.status === "open");
  const error = useLeaveError();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("session.leave.confirmTitle")} data-testid="leave-confirm">
        <p className="text-sm">{t("session.leave.confirmText")}</p>
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
            disabled={!online || pending !== null}
            onClick={() => leaveRoom()}
          >
            {t("session.leave.leave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The room's invite link with a copy button, so the table can fill an open seat. */
function InviteLink({ room }: { room: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = inviteLinkFor(room);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("session.leave.inviteHint")}</span>
      <div className="flex gap-1.5">
        <input
          className={inputClass}
          readOnly
          value={link}
          aria-label={t("session.lobby.inviteLink")}
          onFocus={(e) => e.target.select()}
        />
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? t("session.lobby.copied") : t("session.lobby.copyLink")}
        </Button>
      </div>
    </div>
  );
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

type MenuStep = "menu" | "pause" | "end" | "leave" | null;

/**
 * The "Game" button in the HUD corner while the game runs, for every seated player: "Leave
 * game" and the invite link; the host also gets "Close game for now" (pause) and "End game
 * now". Each action sits behind a confirmation.
 */
export function GameMenu() {
  const { t } = useTranslation();
  const isHost = useIsHost();
  const room = useRoomStore((s) => s.room);
  const seated = useRoomStore((s) => s.seat !== null);
  const playing = useRoomStore((s) => s.status === "playing");
  const pending = useRoomStore((s) => s.pending);
  const online = useConnectionStore((s) => s.status === "open");
  const error = useRequestError();
  const [step, setStep] = useState<MenuStep>(null);
  if (!seated || !playing || room === null) return null;
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
        className="pointer-events-auto grid size-10 cursor-pointer place-items-center hud-leather-round transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:size-11 short:size-11 pointer-coarse:size-11 motion-reduce:transition-none"
        onClick={() => setStep("menu")}
      >
        <Leave aria-hidden className="size-6" />
      </button>
      <Dialog open={step === "menu"} onOpenChange={close}>
        <DialogContent title={t("session.pause.menuTitle")} data-testid="game-menu">
          <div className="flex flex-col gap-2">
            {isHost && (
              <Button
                variant="secondary"
                className="justify-start"
                onClick={() => setStep("pause")}
              >
                <Pause aria-hidden />
                <span className="flex flex-col items-start text-left">
                  <span>{t("session.pause.closeForNow")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("session.pause.closeForNowHint")}
                  </span>
                </span>
              </Button>
            )}
            {isHost && (
              <Button variant="secondary" className="justify-start" onClick={() => setStep("end")}>
                <Flag aria-hidden />
                <span className="flex flex-col items-start text-left">
                  <span>{t("session.pause.endNow")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("session.pause.endNowHint")}
                  </span>
                </span>
              </Button>
            )}
            <Button variant="secondary" className="justify-start" onClick={() => setStep("leave")}>
              <Leave aria-hidden />
              <span className="flex flex-col items-start text-left">
                <span>{t("session.leave.leave")}</span>
                <span className="text-xs text-muted-foreground">{t("session.leave.hint")}</span>
              </span>
            </Button>
            <InviteLink room={room} />
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
      <LeaveGameConfirm open={step === "leave"} onOpenChange={close} />
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
  const [leaving, setLeaving] = useState(false);
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
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={!online || pending !== null}
              onClick={() => setLeaving(true)}
            >
              <Leave aria-hidden />
              {t("session.leave.leave")}
            </Button>
            {isHost && (
              <Button
                variant="secondary"
                disabled={!online || pending !== null}
                onClick={() => setEnding(true)}
              >
                {t("session.pause.end")}
              </Button>
            )}
            {isHost && (
              <Button disabled={!online || pending !== null} onClick={() => resumeGame()}>
                {t("session.pause.resume")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isHost && <EndGameConfirm open={ending} onOpenChange={setEnding} />}
      <LeaveGameConfirm open={leaving} onOpenChange={setLeaving} />
    </>
  );
}
