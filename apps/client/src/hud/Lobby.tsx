// Lobby (specs/client-session, "Lobby", "Invite links"; game-hud "Turn countdown").
import type { AvatarId, BotLevel, TurnTimerPreset } from "@hexfall/protocol";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ChoiceGroup } from "@/components/ui/choice-group.tsx";
import { SealRadio } from "@/components/ui/seal-radio.tsx";
import { seatColor, seatColorName } from "../game/colors.ts";
import {
  addBot,
  leaveRoom,
  removeBot,
  setAvatar,
  setBotLevel,
  startGame,
  type BoardModeChoice,
} from "../net/actions.ts";
import { setPref } from "../store/prefs.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useRoomStore } from "../store/room.ts";
import { Avatar } from "./Avatar.tsx";
import { AvatarPicker } from "./AvatarPicker.tsx";
import { LEVEL_OPTIONS, levelLabel } from "./botLevels.ts";
import { roomErrorText } from "./errors.ts";
import { Swatch } from "./PlayerPanels.tsx";
import { errorClass, hintClass, inputClass, panelBodyClass, panelClass } from "./StartScreen.tsx";

/** Invite link for a room code (same page, `?room=CODE`). */
export function inviteLinkFor(room: string, base: string = window.location.href): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", room);
  return url.toString();
}

/** localStorage key of the host's last turn-timer choice. */
export const TURN_TIMER_KEY = "hexfall.turnTimer";

const TIMER_OPTIONS = [
  { value: "off", label: "session.lobby.timerOff" },
  { value: "standard", label: "session.lobby.timerStandard" },
  { value: "relaxed", label: "session.lobby.timerRelaxed" },
] as const satisfies readonly { value: TurnTimerPreset; label: string }[];

/** The remembered preset, or Standard. Storage may be blocked: never throws. */
export function loadTurnTimer(): TurnTimerPreset {
  try {
    const v = window.localStorage.getItem(TURN_TIMER_KEY);
    if (v === "off" || v === "standard" || v === "relaxed") return v;
  } catch {
    // Storage unavailable (private mode, blocked site data).
  }
  return "standard";
}

function saveTurnTimer(v: TurnTimerPreset): void {
  try {
    window.localStorage.setItem(TURN_TIMER_KEY, v);
  } catch {
    // Not remembered; the choice still applies to this start.
  }
}

/** Shown while seated in a room whose status is "lobby". */
export function Lobby({ inviteLink }: { inviteLink?: string }) {
  const { t } = useTranslation();
  const room = useRoomStore((s) => s.room);
  const seat = useRoomStore((s) => s.seat);
  const host = useRoomStore((s) => s.host);
  const seats = useRoomStore((s) => s.seats);
  const pending = useRoomStore((s) => s.pending);
  const error = useRoomStore((s) => s.error);
  const online = useConnectionStore((s) => s.status === "open");
  const [mode, setMode] = useState<BoardModeChoice>("variable");
  const [starter, setStarter] = useState<string>("");
  const [timer, setTimer] = useState<TurnTimerPreset>(loadTurnTimer);
  const [copied, setCopied] = useState(false);

  if (room === null) return null;
  const link = inviteLink ?? inviteLinkFor(room);
  const isHost = seat !== null && seat === host;
  const mine = seats.find((s) => s.seat === seat);
  const takenAvatars = new Map<AvatarId, string>(
    seats.filter((s) => s.seat !== seat).map((s) => [s.avatar, s.name]),
  );
  // Bots fill empty seats up to 3 on start, so the host can start alone.
  const enough = seats.length >= 1 && seats.length <= 4;
  const busy = pending !== null || !online;
  const lobbyError =
    error && (error.request === "start" || error.request === "leave") ? error : null;

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
    <div className={panelClass} data-interactive>
      <div className={panelBodyClass}>
        <h2 className="mb-2.5 font-serif text-2xl font-semibold">
          {t("session.lobby.room")}{" "}
          <span className="tracking-[0.12em] uppercase tabular-nums">{room}</span>
        </h2>
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

        {mine && (
          <AvatarPicker
            value={mine.avatar}
            seat={mine.seat}
            taken={takenAvatars}
            onChange={(id) => {
              setPref("avatar", id);
              setAvatar(id);
            }}
          />
        )}

        <ul className="my-2 list-none p-0" aria-label={t("session.lobby.players")}>
          {seats.map((s) => {
            const c = seatColor(s.seat);
            return (
              <li
                key={s.seat}
                data-testid="lobby-seat"
                data-connected={s.connected}
                className="flex flex-wrap items-center gap-1.5 py-1"
              >
                <Swatch hex={c.hex} name={seatColorName(s.seat, t)} />
                <Avatar id={s.avatar} seat={s.seat} name={s.name} size="sm" eager />
                <span className={s.connected ? "" : "opacity-60"}>{s.name}</span>
                {s.seat === seat && <Badge variant="muted">{t("session.lobby.you")}</Badge>}
                {s.seat === host && <Badge variant="muted">{t("session.lobby.host")}</Badge>}
                {s.bot && <Badge variant="muted">{t("session.lobby.bot")}</Badge>}
                {s.bot &&
                  (isHost ? (
                    <ChoiceGroup
                      className="order-last w-full pl-7"
                      size="sm"
                      data-testid="bot-level"
                      label={t("session.lobby.levelNamed", { name: s.name })}
                      options={LEVEL_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
                      value={s.level ?? "normal"}
                      disabled={busy}
                      onChange={(level: BotLevel) => setBotLevel(s.seat, level)}
                    />
                  ) : (
                    <span className="ml-auto text-sm opacity-75" data-testid="bot-level">
                      {t(levelLabel(s.level))}
                    </span>
                  ))}
                {isHost && s.bot && (
                  <Button
                    variant="link"
                    className="min-h-0 p-0"
                    disabled={busy}
                    aria-label={t("session.lobby.removeBotNamed", { name: s.name })}
                    onClick={() => removeBot(s.seat)}
                  >
                    {t("session.lobby.removeBot")}
                  </Button>
                )}
                {!s.connected && (
                  <Badge variant="muted" className="text-bad">
                    {t("session.lobby.offline")}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>

        {isHost ? (
          <div className="flex flex-col gap-1.5">
            <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
              <legend className="mb-1 font-semibold">{t("session.lobby.board")}</legend>
              {(["variable", "beginner"] as const).map((m) => (
                <SealRadio
                  key={m}
                  name="hud-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                >
                  {m === "variable" ? t("session.lobby.variable") : t("session.lobby.beginner")}
                </SealRadio>
              ))}
            </fieldset>
            <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
              <legend className="mb-1 font-semibold">{t("session.lobby.turnTimer")}</legend>
              {TIMER_OPTIONS.map((o) => (
                <SealRadio
                  key={o.value}
                  name="hud-turn-timer"
                  value={o.value}
                  checked={timer === o.value}
                  onChange={() => {
                    setTimer(o.value);
                    saveTurnTimer(o.value);
                  }}
                >
                  {t(o.label)}
                </SealRadio>
              ))}
            </fieldset>
            <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
              <legend className="mb-1 font-semibold">{t("session.lobby.startingPlayer")}</legend>
              {[
                { value: "", label: t("session.lobby.rollForIt") },
                ...seats.map((s) => ({ value: String(s.seat), label: s.name })),
              ].map((o) => (
                <SealRadio
                  key={o.value}
                  name="hud-starter"
                  value={o.value}
                  checked={starter === o.value}
                  onChange={() => setStarter(o.value)}
                >
                  {o.label}
                </SealRadio>
              ))}
            </fieldset>
            {seats.length < 4 && (
              <Button variant="secondary" disabled={busy} onClick={() => addBot()}>
                {t("session.lobby.addBot")}
              </Button>
            )}
            {seats.length < 3 && <p className={hintClass}>{t("session.lobby.botsWillFill")}</p>}
            <Button
              disabled={!enough || busy}
              onClick={() => startGame(mode, starter === "" ? undefined : Number(starter), timer)}
            >
              {t("session.lobby.startGame")}
            </Button>
          </div>
        ) : (
          <p className={hintClass}>{t("session.lobby.waitingForHost")}</p>
        )}

        <Button
          variant="secondary"
          className="mt-1"
          disabled={pending !== null || !online}
          onClick={() => leaveRoom()}
        >
          {t("session.lobby.leaveRoom")}
        </Button>
        {lobbyError && (
          <p className={errorClass} role="alert">
            {roomErrorText(lobbyError.code, lobbyError.message, t)}
          </p>
        )}
      </div>
    </div>
  );
}
