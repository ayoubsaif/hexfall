// One compact panel per seat (specs/compact-player-panels). Never shows others' hands.
// Stats are icon + number chips; the words live in sr-only text and tooltips.
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge.tsx";
import { seatColor, seatColorName } from "../game/colors.ts";
import { SeatAvatar } from "./Avatar.tsx";
import { CountdownText } from "./actions/CountdownText.tsx";
import { useCountdown } from "./countdown.ts";
import { type GameIconName, gameIcon } from "./GameIcon.tsx";
import { useBotSeat, useConnected, useNames, useOpenSeat } from "./names.ts";
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

// Stats in display order, each with its painted icon.
const STATS = [
  { stat: "vp", icon: "vp" },
  { stat: "cards", icon: "hand" },
  { stat: "dev", icon: "devcard" },
  { stat: "knights", icon: "knight" },
] as const satisfies readonly { stat: string; icon: GameIconName }[];

const ICONS = {
  vp: gameIcon("vp"),
  hand: gameIcon("hand"),
  devcard: gameIcon("devcard"),
  knight: gameIcon("knight"),
};
const RoadIcon = gameIcon("road");
const KnightIcon = gameIcon("knight");

/** Small gold-ringed badge on the avatar corner for a special card. */
function Medal({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      data-testid="medal"
      title={label}
      className="inline-flex size-[18px] items-center justify-center rounded-full bg-[#3e2616] ring-1 ring-[#c9a04e] max-sm:size-4"
    >
      {children}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Mount while a game view is present. */
export function PlayerPanels() {
  const view = useView();
  const names = useNames();
  const connected = useConnected();
  const openSeat = useOpenSeat();
  const botSeat = useBotSeat();
  const countdown = useCountdown();
  const { t } = useTranslation();
  if (!view) return null;
  const active = view.phase.kind === "ended" ? null : view.turn.seat;
  return (
    <ol
      aria-label={t("play.panels.players")}
      className="m-0 flex w-full list-none flex-nowrap gap-2 p-0 max-sm:gap-1 short:gap-1"
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
        const hidden = own && p.hiddenVp !== undefined && p.hiddenVp > 0 ? p.hiddenVp : 0;
        return (
          <li
            key={p.seat}
            data-testid="player-panel"
            data-seat={p.seat}
            data-active={isActive || undefined}
            data-own={own || undefined}
            aria-current={isActive ? "true" : undefined}
            className="pointer-events-auto relative flex max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:items-center max-sm:gap-y-0.5 short:grid short:grid-cols-[auto_minmax(0,1fr)] short:items-center short:gap-y-0.5 min-w-0 max-w-[260px] flex-1 basis-0 items-center gap-2 overflow-hidden player-card rounded-none border-2 border-leather frame [--corner-size:12px] paper py-1.5 pr-2 pl-3.5 max-sm:gap-1.5 max-sm:py-1 max-sm:pr-1 max-sm:pl-2.5 short:gap-1.5 short:py-1 short:pr-1 short:pl-2.5"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ background: c.hex }}
            />
            <div className="relative shrink-0">
              <SeatAvatar seat={p.seat} size="xl" className="max-sm:size-7 short:size-7" />
              <span className="sr-only">{seatColorName(p.seat, t)}</span>
              {(view.longestRoad === p.seat || view.largestArmy === p.seat) && (
                <span className="absolute -right-1.5 -bottom-1.5 flex gap-0.5">
                  {view.longestRoad === p.seat && (
                    <Medal label={t("play.panels.longestRoad")}>
                      <RoadIcon className="size-3.5 max-sm:size-3" />
                    </Medal>
                  )}
                  {view.largestArmy === p.seat && (
                    <Medal label={t("play.panels.largestArmy")}>
                      <KnightIcon className="size-3.5 max-sm:size-3" />
                    </Medal>
                  )}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 max-sm:contents short:contents">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[15px] leading-tight font-semibold max-sm:text-xs short:text-xs">
                  {names(p.seat)}
                </span>
                {own && (
                  <Badge variant="muted" className="max-sm:sr-only">
                    {t("play.panels.you")}
                  </Badge>
                )}
                {waiting && (
                  <CountdownText
                    countdown={waiting}
                    className="ml-auto text-[11px] font-semibold max-sm:text-[10px] short:text-[10px]"
                  />
                )}
                {botSeat(p.seat) && (
                  <Badge
                    variant="muted"
                    data-testid="bot-seat"
                    title={t("play.panels.botHint")}
                    className="shrink-0 gap-0.5"
                  >
                    <Bot aria-hidden="true" className="size-3.5 max-sm:size-3 short:size-3" />
                    <span className="max-sm:sr-only short:sr-only">{t("play.panels.bot")}</span>
                    <span className="sr-only">{`, ${t("play.panels.botHint")}`}</span>
                  </Badge>
                )}
                {openSeat(p.seat) && (
                  <Badge
                    variant="muted"
                    data-testid="open-seat"
                    title={t("play.panels.openSeatHint")}
                  >
                    {t("play.panels.openSeat")}
                  </Badge>
                )}
                {!online && (
                  <Badge variant="muted" className="text-bad" data-testid="offline">
                    {t("play.panels.offline")}
                  </Badge>
                )}
              </div>
              <dl className="m-0 mt-0.5 grid grid-cols-4 gap-x-2 max-sm:col-span-2 max-sm:mt-0 max-sm:grid-cols-2 max-sm:gap-x-1 max-sm:gap-y-0.5 short:col-span-2 short:mt-0 short:grid-cols-2 short:gap-x-1 short:gap-y-0.5">
                {STATS.map(({ stat, icon }) => {
                  const Icon = ICONS[icon];
                  const label = t(`play.panels.stat.${stat}`);
                  return (
                    <div key={stat} title={label} className="flex min-w-0 items-center gap-1">
                      <dt className="flex shrink-0">
                        <Icon className="size-6 shrink-0 max-sm:size-[18px] short:size-[18px]" />
                        <span className="sr-only">{label}</span>
                      </dt>
                      <dd
                        className="m-0 text-[18px] leading-none font-bold tabular-nums max-sm:text-sm short:text-sm"
                        data-stat={stat}
                      >
                        {values[stat]}
                      </dd>
                      {stat === "vp" && hidden > 0 && (
                        <span
                          className="text-xs font-bold text-wait max-sm:text-[10px]"
                          title={t("play.panels.hiddenTitle")}
                        >
                          +{hidden}
                          <span className="sr-only">
                            {" "}
                            {t("play.panels.hiddenVp", { vp: p.publicVp + hidden })}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </dl>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
