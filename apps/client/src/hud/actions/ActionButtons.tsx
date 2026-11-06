// Floating turn controls (specs/game-hud "Turn status and controls", "Turn countdown";
// specs/hud-presentation "Resource picture cards": cost hints as small cards; design decision 6).
// Build road / settlement / city, Buy development card, Trade with bank, Trade with players
// (specs/player-trade "Trade with players button") and End turn, as round
// icon buttons with no panel. Shown only to the active player after setup.
import type { Resource, ResourceBundle, ResourceCounts } from "@hexfall/engine";
import { COSTS, RESOURCES } from "@hexfall/engine/geometry";
import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { isStaleBuild } from "../../game/pick.ts";
import { controlsOf, showBuildControls } from "../../game/status.ts";
import type { T } from "../../i18n/index.ts";
import { resourceLabel } from "../../i18n/labels.ts";
import { act } from "../../net/actions.ts";
import {
  type BuildChoice,
  chooseBuild,
  openDialog,
  openTrade,
  useUiStore,
} from "../../store/ui.ts";
import { GameCard } from "../cards/GameCard.tsx";
import { countdownText, useCountdown } from "../countdown.ts";
import { useInFlight, useLegal, useOwn, useView } from "../state.ts";
import type { HotkeyId } from "../../hotkeys/registry.ts";
import { gameIcon } from "../GameIcon.tsx";
import { Fab, type FabRing } from "./Fab.tsx";

/** "1 Brick, 1 Lumber". */
export function costText(cost: ResourceBundle, t: T): string {
  return RESOURCES.filter((r) => (cost[r] ?? 0) > 0)
    .map((r) => t("play.actions.costItem", { count: cost[r] ?? 0, resource: resourceLabel(t, r) }))
    .join(", ");
}

/** One small card per card of the cost, in resource order (city: grain ×2, ore ×3). */
export function costCards(cost: ResourceBundle): Resource[] {
  return RESOURCES.flatMap((r) => Array.from({ length: cost[r] ?? 0 }, () => r));
}

/** Cost as small picture cards; decorative, the text equivalent is the button's description. */
export function CostCards({ cost }: { cost: ResourceBundle }) {
  return (
    <span className="flex gap-0.5" aria-hidden="true" data-cost>
      {costCards(cost).map((r, i) => (
        <GameCard key={`${r}${i}`} resource={r} size="sm" />
      ))}
    </span>
  );
}

/** Why a paid build is unavailable, as a key under play.actions.blocked (null: it is available). */
export function blockedReason(
  kind: BuildChoice,
  opts: { rolled: boolean; left: number | undefined; hand: ResourceCounts | undefined },
  cost: ResourceBundle,
): "rollFirst" | "pieces" | "cards" | BuildChoice | null {
  if (!opts.rolled) return "rollFirst";
  if (opts.left !== undefined && opts.left <= 0) return "pieces";
  if (opts.hand && RESOURCES.some((r) => (opts.hand?.[r] ?? 0) < (cost[r] ?? 0))) return "cards";
  return kind; // cards and pieces are fine, so no legal spot is left
}

/** Tooltip body for a build or buy button: the action, its cost as cards and, when it is off, why. */
function CostTip({
  label,
  cost,
  reason,
}: {
  label: string;
  cost: ResourceBundle;
  reason?: string | undefined;
}) {
  return (
    <span className="flex max-w-[260px] flex-col items-start gap-1" data-cost-tip>
      <span className="font-semibold">{label}</span>
      <CostCards cost={cost} />
      {reason && (
        <span data-blocked-reason className="text-xs leading-snug text-bad">
          {reason}
        </span>
      )}
    </span>
  );
}

type Piece = "roads" | "settlements" | "cities";

const BUILDS: {
  kind: BuildChoice;
  /** Key under play.actions. */
  label: "buildRoad" | "buildSettlement" | "buildCity";
  icon: LucideIcon;
  cost: ResourceBundle;
  piece: Piece;
  legal: "buildRoad" | "buildSettlement" | "buildCity";
  hotkey: HotkeyId;
}[] = [
  {
    kind: "road",
    label: "buildRoad",
    icon: gameIcon("road"),
    cost: COSTS.road,
    piece: "roads",
    legal: "buildRoad",
    hotkey: "buildRoad",
  },
  {
    kind: "settlement",
    label: "buildSettlement",
    icon: gameIcon("settlement"),
    cost: COSTS.settlement,
    piece: "settlements",
    legal: "buildSettlement",
    hotkey: "buildSettlement",
  },
  {
    kind: "city",
    label: "buildCity",
    icon: gameIcon("city"),
    cost: COSTS.city,
    piece: "cities",
    legal: "buildCity",
    hotkey: "buildCity",
  },
];

/** Mount while a game view is present. Renders nothing unless the viewer is active. */
export function ActionButtons() {
  const view = useView();
  const legal = useLegal();
  const inFlight = useInFlight();
  const own = useOwn();
  const build = useUiStore((s) => s.build);
  const countdown = useCountdown();
  const { t } = useTranslation();

  // A chosen build whose targets vanished (e.g. cards spent) is dropped.
  useEffect(() => {
    if (build && isStaleBuild(legal, build)) chooseBuild(null);
  }, [build, legal]);

  if (!view || !showBuildControls(view, view.viewer)) return null;
  const c = controlsOf(view, legal, inFlight);
  const viewer = view.viewer!;

  // The End turn ring: the viewer's own main turn after the roll.
  const ring: FabRing | null =
    countdown &&
    countdown.kind === "action" &&
    view.phase.kind === "turn" &&
    view.turn.rolled &&
    countdown.seats.includes(viewer)
      ? {
          fraction: countdown.fraction,
          warning: countdown.warning,
          text: countdownText(countdown.secondsLeft, t),
        }
      : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="group"
        aria-label={t("play.actions.group")}
        data-testid="action-buttons"
        className="flex items-center gap-2 max-sm:flex-col max-sm:gap-1.5"
      >
        {BUILDS.map((b) => {
          const active = build === b.kind;
          const left = own?.pieces[b.piece];
          const cost = t("play.actions.costs", { cost: costText(b.cost, t) });
          const label = t(`play.actions.${b.label}`);
          const off = !c[b.legal] && !active;
          const why =
            off && view.phase.kind === "turn"
              ? blockedReason(
                  b.kind,
                  { rolled: view.turn.rolled, left, hand: own?.resources },
                  b.cost,
                )
              : null;
          const reason = why ? t(`play.actions.blocked.${why}`) : undefined;
          return (
            <Fab
              key={b.kind}
              icon={b.icon}
              label={label}
              tooltip={<CostTip label={label} cost={b.cost} reason={reason} />}
              hotkey={b.hotkey}
              badge={left}
              description={[
                left === undefined
                  ? cost
                  : `${cost}. ${t(`play.actions.left.${b.piece}`, { count: left })}`,
                reason,
              ]
                .filter(Boolean)
                .join(". ")}
              data-blocked={why ?? undefined}
              aria-pressed={active}
              disabled={off}
              onClick={() => chooseBuild(active ? null : b.kind)}
            />
          );
        })}
        <Fab
          icon={gameIcon("devcard")}
          label={t("play.actions.buyDevCard")}
          hotkey="buyDevCard"
          tooltip={<CostTip label={t("play.actions.buyDevCard")} cost={COSTS.devCard} />}
          description={t("play.actions.costs", { cost: costText(COSTS.devCard, t) })}
          disabled={!c.buyDevCard}
          onClick={() => act({ type: "buyDevCard" })}
        />
        <Fab
          icon={gameIcon("bank")}
          label={t("play.actions.tradeBank")}
          hotkey="tradeBank"
          disabled={!c.maritime}
          onClick={() => openDialog("maritime")}
        />
        <Fab
          icon={gameIcon("trade")}
          label={t("play.actions.tradePlayers")}
          hotkey="tradePlayers"
          disabled={!c.proposeTrade}
          onClick={() =>
            openTrade({
              give: {},
              get: {},
              to: view.players.map((_, i) => i).filter((s) => s !== viewer),
            })
          }
        />
        <Fab
          icon={gameIcon("endturn")}
          label={t("play.actions.endTurn")}
          hotkey="endTurn"
          primary
          ring={ring}
          disabled={!c.endTurn}
          onClick={() => act({ type: "endTurn" })}
        />
      </div>
    </TooltipProvider>
  );
}
