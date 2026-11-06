// Start screen (specs/client-session, "Start screen", "Invite links", "Server errors").
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { createRoom, joinRoom } from "../net/actions.ts";
import { SEAT_LOST_NOTICE } from "../net/session.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useRoomStore } from "../store/room.ts";
import { roomErrorText } from "./errors.ts";
import { SavedGames } from "./SavedGames.tsx";

export const NAME_MAX = 20;

/** Shared looks for the start screen and lobby (both centered HUD cards). */
export const panelClass =
  "pointer-events-auto absolute top-1/2 left-1/2 flex max-h-[calc(100%-32px)] w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-1.5 overflow-auto frame paper rounded-xl p-6 text-sm backdrop-blur-sm";
export const inputClass =
  "min-h-9 w-full min-w-0 rounded-md border border-ink/30 bg-cream/70 px-2 py-1.5 text-hud-fg outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10";
export const fieldClass = "my-1.5 flex flex-col gap-1";
export const hintClass = "my-1 text-muted-foreground data-[bad]:text-bad";
export const errorClass = "my-1.5 text-bad";

/** Trimmed name, or null when it is not 1–20 characters. */
export function checkName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

/** Shown while not in a room (mount when `room === null`). */
export function StartScreen() {
  const { t } = useTranslation();
  const online = useConnectionStore((s) => s.status === "open");
  const prefill = useRoomStore((s) => s.prefillRoom);
  const pending = useRoomStore((s) => s.pending);
  const error = useRoomStore((s) => s.error);
  const notice = useRoomStore((s) => s.notice);
  const [name, setName] = useState("");
  const [code, setCode] = useState(prefill ?? "");
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
      <h1 className="font-serif text-4xl leading-none font-semibold text-forest">Hexfall</h1>
      <p className="mb-1 font-serif text-lg text-ink-muted">{t("session.start.tagline")}</p>
      <p className="mb-2 text-muted-foreground">{t("session.start.description")}</p>
      {notice && (
        <p className="text-wait" role="status">
          {notice === SEAT_LOST_NOTICE ? t("session.start.seatLost") : notice}
        </p>
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

      {!invited && (
        <Button disabled={!canCreate} onClick={() => valid && createRoom(valid)}>
          {t("session.start.createRoom")}
        </Button>
      )}

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
          onClick={() => valid && joinRoom(code.trim(), valid)}
        >
          {t("session.start.joinRoom")}
        </Button>
      </div>
      {invited && (
        <Button
          variant="link"
          className="min-h-0 self-start"
          disabled={!canCreate}
          onClick={() => valid && createRoom(valid)}
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
  );
}
