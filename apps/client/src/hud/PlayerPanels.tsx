// One panel per seat (specs/game-hud, "Player panels"). Never shows others' hands.
// Compact rows on mobile and short screens (specs/hud-presentation "Responsive HUD layout").
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge.tsx";
import { seatColor, seatColorName } from "../game/colors.ts";
import { CountdownText } from "./actions/CountdownText.tsx";
import { useCountdown } from "./countdown.ts";
import { useConnected, useNames } from "./names.ts";
import { useView } from "./state.ts";

/** A seat's color square. */
export function Swatch({ hex, name }: { hex: string; name: string }) {
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-[3px] border border-black/50 align-middle"
      style={{ background: hex }}
      title={name}
    />
  );
}

// Stats in display order; each has a full label and a short one for compact panels.
const STATS = ["vp", "cards", "dev", "knights"] as const;

/** Mount while a game view is present. */
export function PlayerPanels() {
  const view = useView();
  const names = useNames();
  const connected = useConnected();
  const countdown = useCountdown();
  const { t } = useTranslation();
  if (!view) return null;
  const active = view.phase.kind === "ended" ? null : view.turn.seat;
  return (
    <ol
      aria-label={t("play.panels.players")}
      className="m-0 flex list-none flex-wrap gap-2 p-0 max-sm:flex-nowrap max-sm:gap-1 short:flex-nowrap short:gap-1"
    >
      {view.players.map((p) => {
        const c = seatColor(p.seat);
        const own = p.seat === view.viewer;
        const online = connected(p.seat);
        const isActive = p.seat === active;
        // Another seat the game is waiting on shows its countdown (the viewer's own shows on
        // the dice, End turn, the discard dialog or the status pill).
        const waiting =
          countdown !== null && !own && countdown.seats.includes(p.seat) ? countdown : null;
        const values = {
          vp: p.publicVp,
          cards: p.resourceCount,
          dev: p.devCardCount,
          knights: p.knights,
        };
        return (
          <li
            key={p.seat}
            data-testid="player-panel"
            data-active={isActive || undefined}
            data-own={own || undefined}
            aria-current={isActive ? "true" : undefined}
            className="pointer-events-auto min-w-[150px] overflow-hidden rounded-md border-2 border-leather paper data-[active]:ring-2 data-[active]:ring-wait max-sm:min-w-0 max-sm:flex-1 short:min-w-0 short:flex-1"
          >
            <div
              className="hud-card-head flex min-w-0 items-center gap-1.5 px-2.5 py-1 font-semibold max-sm:px-1.5 max-sm:text-[11px] short:px-1.5 short:text-[11px]"
              style={{ boxShadow: `inset 4px 0 0 ${c.hex}` }}
            >
              <Swatch hex={c.hex} name={seatColorName(p.seat, t)} />
              <span className="truncate">{names(p.seat)}</span>
              {own && <Badge variant="muted">{t("play.panels.you")}</Badge>}
              {waiting && (
                <CountdownText
                  countdown={waiting}
                  className="ml-auto text-[11px] font-semibold max-sm:text-[10px] short:text-[10px]"
                />
              )}
              {!online && (
                <Badge variant="muted" className="text-bad" data-testid="offline">
                  {t("play.panels.offline")}
                </Badge>
              )}
            </div>
            <div className="px-2.5 py-1.5 max-sm:px-1.5 max-sm:py-1 max-sm:text-[11px] short:px-1.5 short:py-1 short:text-[11px]">
              <dl className="mb-0 grid grid-cols-[repeat(4,auto)] gap-x-2.5 gap-y-0.5 max-sm:grid-cols-2 max-sm:gap-x-1.5 short:mt-0.5 short:gap-x-1.5">
                {STATS.map((stat) => (
                  <div
                    key={stat}
                    className="max-sm:flex max-sm:items-baseline max-sm:gap-1 short:flex short:items-baseline short:gap-1"
                  >
                    <dt className="text-[10px] text-muted-foreground max-sm:text-[9px] short:text-[9px]">
                      <span className="max-sm:sr-only short:sr-only">
                        {t(`play.panels.stat.${stat}`)}
                      </span>
                      <span aria-hidden="true" className="hidden max-sm:inline short:inline">
                        {t(`play.panels.stat.${stat}Short`)}
                      </span>
                    </dt>
                    <dd className="m-0 tabular-nums" data-stat={stat}>
                      {values[stat]}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-1 flex flex-wrap gap-1 empty:hidden max-sm:text-[10px]">
                {view.longestRoad === p.seat && (
                  <Badge variant="accent">{t("play.panels.longestRoad")}</Badge>
                )}
                {view.largestArmy === p.seat && (
                  <Badge variant="accent">{t("play.panels.largestArmy")}</Badge>
                )}
                {own && p.hiddenVp !== undefined && p.hiddenVp > 0 && (
                  <span className="text-[11px] text-wait" title={t("play.panels.hiddenTitle")}>
                    {t("play.panels.hiddenVp", { vp: p.publicVp + p.hiddenVp })}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
