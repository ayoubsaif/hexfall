// Start screen (specs/client-session, "Start screen", "Invite links", "Server errors").
import { AVATAR_IDS } from "@hexfall/protocol";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { createRoom, joinRoom, playSolo } from "../net/actions.ts";
import { SEAT_LOST_NOTICE } from "../net/session.ts";
import { useConnectionStore } from "../store/connection.ts";
import { setPref, usePrefsStore } from "../store/prefs.ts";
import { useRoomStore } from "../store/room.ts";
import { AvatarPicker } from "./AvatarPicker.tsx";
import { roomErrorText } from "./errors.ts";
import type { GameMode } from "./GameModeButtons.tsx";
import { SavedGames } from "./SavedGames.tsx";

export const NAME_MAX = 20;

/** Shared looks for the start screen and lobby (both centered HUD cards). */
export const panelClass =
  "pointer-events-auto absolute top-1/2 left-1/2 flex max-h-[calc(100%-112px)] w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden frame frame-brass frame-corners paper rounded-none text-sm";
/** The scrolling body inside the fixed panel box (keeps the corner plates on the border). */
export const panelBodyClass = "flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto p-7";
export const inputClass =
  "min-h-9 w-full min-w-0 rounded-none border border-ink/30 bg-cream/70 px-2 py-1.5 text-hud-fg outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10";
export const fieldClass = "my-1.5 flex flex-col gap-1";
export const hintClass = "my-1 text-muted-foreground data-[bad]:text-bad";
export const errorClass = "my-1.5 text-bad";

/** Trimmed name, or null when it is not 1–20 characters. */
export function checkName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

/** Shown while not in a room (mount when `room === null`). */
export function StartScreen({
  mode,
  onBack,
}: { mode?: GameMode | undefined; onBack?: () => void } = {}) {
  const { t } = useTranslation();
  const online = useConnectionStore((s) => s.status === "open");
  const prefill = useRoomStore((s) => s.prefillRoom);
  const pending = useRoomStore((s) => s.pending);
  const error = useRoomStore((s) => s.error);
  const notice = useRoomStore((s) => s.notice);
  const [name, setName] = useState("");
  const [code, setCode] = useState(prefill ?? "");
  const avatar = usePrefsStore((s) => s.avatar) ?? AVATAR_IDS[0];
  const [opponents, setOpponents] = useState<2 | 3>(2);
  // An invite code can arrive after mount (read from the address by the session).
  useEffect(() => {
    if (prefill) setCode((c) => (c === "" ? prefill : c));
  }, [prefill]);

  const valid = checkName(name);
  const tooLong = name.trim().length > NAME_MAX;
  const busy = pending !== null;
  const canCreate = online && valid !== null && !busy;
  const canJoin = canCreate && code.trim().length > 0;
  const invited = prefill !== null;
  const formError =
    error && (error.request === "create" || error.request === "join") ? error : null;

  return (
    <div className={panelClass} data-interactive>
      <div className={panelBodyClass}>
        <h1 className="font-serif text-4xl leading-none font-semibold text-forest">Hexfall</h1>
        <p className="mb-1 font-serif text-lg text-ink-muted">{t("session.start.tagline")}</p>
        <p className="mb-2 text-muted-foreground">{t("session.start.description")}</p>
        {notice && (
          <p className="text-wait" role="status">
            {notice === SEAT_LOST_NOTICE ? t("session.start.seatLost") : notice}
          </p>
        )}
        {onBack && !invited && (
          <Button variant="link" className="self-start" onClick={onBack} disabled={busy}>
            {t("session.modes.back")}
          </Button>
        )}
        {mode && (
          <h2 className="my-2 font-serif text-xl text-forest">
            {t(`session.modes.${mode}.title`)}
          </h2>
        )}
        <SavedGames busy={busy} />
        <label className={fieldClass}>
          <span>{t("session.start.yourName")}</span>
          <input
            className={inputClass}
            value={name}
            maxLength={40}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={tooLong || undefined}
            aria-describedby="hud-name-hint"
          />
        </label>
        <p
          id="hud-name-hint"
          data-testid="name-hint"
          className={hintClass}
          data-bad={tooLong || undefined}
        >
          {tooLong
            ? t("session.start.nameTooLong", { max: NAME_MAX })
            : t("session.start.nameHint", { max: NAME_MAX })}
        </p>
        <AvatarPicker value={avatar} onChange={(id) => setPref("avatar", id)} />

        {!invited && (!mode || mode === "host") && (
          <Button disabled={!canCreate} onClick={() => valid && createRoom(valid, avatar)}>
            {t("session.start.createRoom")}
          </Button>
        )}

        {!invited && (!mode || mode === "solo") && (
          <div className="flex items-end gap-2">
            <label className={`${fieldClass} flex-1`}>
              <span>{t("session.start.soloOpponents")}</span>
              <select
                className={inputClass}
                value={opponents}
                onChange={(e) => setOpponents(e.target.value === "3" ? 3 : 2)}
              >
                {([2, 3] as const).map((n) => (
                  <option key={n} value={n}>
                    {t("session.start.soloOpponentsOption", { count: n })}
                  </option>
                ))}
              </select>
            </label>
            <Button
              className="mb-1.5"
              variant="secondary"
              disabled={!canCreate}
              onClick={() => valid && playSolo(valid, opponents, avatar)}
            >
              {t("session.start.playSolo")}
            </Button>
          </div>
        )}

        {(invited || !mode || mode === "join") && (
          <div className="flex items-end gap-2">
            <label className={`${fieldClass} flex-1`}>
              <span>{t("session.start.roomCode")}</span>
              <input
                className={`${inputClass} tracking-[0.12em] uppercase tabular-nums`}
                value={code}
                maxLength={16}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <Button
              className="mb-1.5"
              variant={invited ? "default" : "secondary"}
              disabled={!canJoin}
              onClick={() => valid && joinRoom(code.trim(), valid, avatar)}
            >
              {t("session.start.joinRoom")}
            </Button>
          </div>
        )}
        {invited && (
          <Button
            variant="link"
            className="min-h-0 self-start"
            disabled={!canCreate}
            onClick={() => valid && createRoom(valid, avatar)}
          >
            {t("session.start.createInstead")}
          </Button>
        )}

        {formError && (
          <p className={errorClass} role="alert">
            {roomErrorText(formError.code, formError.message, t)}
          </p>
        )}
        {!online && <p className={hintClass}>{t("session.start.waitingForServer")}</p>}
      </div>
    </div>
  );
}
