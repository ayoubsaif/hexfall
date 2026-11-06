// "Your games" on the start screen (specs/saved-games "Saved games list"): every room this
// browser holds a seat in, from a server lookup; Continue resumes, Remove forgets locally.
import { X } from "lucide-react";
import { gameIcon } from "./GameIcon.tsx";

const Flag = gameIcon("flag");
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { continueGame, endSavedGame, forgetGame, lookupSeats } from "../net/actions.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useSavedGamesStore, type SavedGame } from "../store/savedGames.ts";
import { roomErrorText } from "./errors.ts";
import { EndGameConfirm, formatDate } from "./GamePause.tsx";

function Entry({ game, busy }: { game: SavedGame; busy: boolean }) {
  const { t, i18n } = useTranslation();
  const ending = useSavedGamesStore((s) => s.ending);
  const failed = useSavedGamesStore((s) => (s.error?.room === game.room ? s.error : null));
  const [confirming, setConfirming] = useState(false);
  const date = (ms: number) => formatDate(ms, i18n.language);
  const canEnd = game.seat === game.host && (game.status === "playing" || game.status === "paused");
  return (
    <li
      className="flex items-start gap-2 rounded-none bg-ink/10 p-2.5"
      data-testid="saved-game"
      data-room={game.room}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold tracking-[0.08em] tabular-nums">
          {t("session.saved.room", { code: game.room })}
        </span>
        <span className="text-xs" data-status={game.status}>
          {t(`session.saved.status.${game.status}`)}
          {game.turn !== null && game.status !== "lobby" && (
            <> · {t("session.saved.turn", { n: game.turn })}</>
          )}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {game.names.map((name, seat) => (
            <span key={seat}>
              {seat > 0 && ", "}
              <span className={seat === game.seat ? "font-semibold text-hud-fg" : undefined}>
                {name}
                {game.bots[seat] && ` (${t("session.lobby.bot")})`}
                {seat === game.seat && ` (${t("session.saved.you")})`}
              </span>
            </span>
          ))}
        </span>
        <span className="text-xs text-muted-foreground" data-testid="saved-dates">
          {game.startedAt === null
            ? t("session.saved.created", { date: date(game.createdAt) })
            : t("session.saved.started", { date: date(game.startedAt) })}
          {game.lastActiveAt !== null && game.startedAt !== null && (
            <> · {t("session.saved.lastMove", { date: date(game.lastActiveAt) })}</>
          )}
        </span>
        {game.status === "paused" && game.expiresAt !== null && (
          <span className="text-xs text-muted-foreground">
            {t("session.saved.expires", { date: formatDate(game.expiresAt, i18n.language) })}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" disabled={busy} onClick={() => continueGame(game.room)}>
          {t("session.saved.continue")}
        </Button>
        {canEnd && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("session.saved.endLabel", { code: game.room })}
            title={t("session.saved.end")}
            disabled={busy || ending !== null}
            onClick={() => setConfirming(true)}
          >
            <Flag aria-hidden />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("session.saved.removeLabel", { code: game.room })}
          title={t("session.saved.remove")}
          onClick={() => forgetGame(game.room)}
        >
          <X aria-hidden />
        </Button>
      </div>
      {canEnd && (
        <EndGameConfirm
          open={confirming}
          onOpenChange={setConfirming}
          onConfirm={() => endSavedGame(game.room)}
          busy={ending !== null}
          error={failed ? roomErrorText(failed.code, failed.message, t) : null}
        />
      )}
    </li>
  );
}

/** Mounted inside the start screen; asks the server whenever it shows while connected. */
export function SavedGames({ busy }: { busy: boolean }) {
  const { t } = useTranslation();
  const online = useConnectionStore((s) => s.status === "open");
  const entries = useSavedGamesStore((s) => s.entries);
  const loading = useSavedGamesStore((s) => s.loading);
  useEffect(() => {
    if (online) lookupSeats();
  }, [online]);
  if (entries.length === 0 && !loading) return null;
  return (
    <section className="mb-2 flex flex-col gap-1.5" aria-labelledby="saved-games-title">
      <h2 id="saved-games-title" className="font-serif text-lg font-semibold">
        {t("session.saved.title")}
      </h2>
      {loading && entries.length === 0 ? (
        <p className="text-xs text-muted-foreground" role="status">
          {t("session.saved.loading")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5" aria-busy={loading || undefined}>
          {entries.map((g) => (
            <Entry key={g.room} game={g} busy={busy || !online} />
          ))}
        </ul>
      )}
    </section>
  );
}
