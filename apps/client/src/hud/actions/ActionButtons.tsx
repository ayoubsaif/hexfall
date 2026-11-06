// Floating turn controls (specs/game-hud "Turn status and controls", "Turn countdown";
// specs/hud-presentation "Resource picture cards": cost hints as small cards; design decision 6).
// Build road / settlement / city, Buy development card, Trade with bank, Trade with players
// (specs/player-trade "Trade with players button") and End turn, as round
// icon buttons with no panel. Shown only to the active player after setup.
import type { Resource, ResourceBundle } from "@hexfall/engine";
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

/** Tooltip body for a build or buy button: the action and its cost as cards. */
function CostTip({ label, cost }: { label: string; cost: ResourceBundle }) {
  return (
    <span className="flex flex-col items-start gap-1" data-cost-tip>
      <span className="font-semibold">{label}</span>
      <CostCards cost={cost} />
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
}[] = [
  {
    kind: "road",
    label: "buildRoad",
    icon: gameIcon("road"),
    cost: COSTS.road,
    piece: "roads",
    legal: "buildRoad",
  },
  {
    kind: "settlement",
    label: "buildSettlement",
    icon: gameIcon("settlement"),
    cost: COSTS.settlement,
    piece: "settlements",
    legal: "buildSettlement",
  },
  {
    kind: "city",
    label: "buildCity",
    icon: gameIcon("city"),
    cost: COSTS.city,
    piece: "cities",
    legal: "buildCity",
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
          return (
            <Fab
              key={b.kind}
              icon={b.icon}
              label={label}
              tooltip={<CostTip label={label} cost={b.cost} />}
              badge={left}
              description={
                left === undefined
                  ? cost
                  : `${cost}. ${t(`play.actions.left.${b.piece}`, { count: left })}`
              }
              aria-pressed={active}
              disabled={!c[b.legal] && !active}
              onClick={() => chooseBuild(active ? null : b.kind)}
            />
          );
        })}
        <Fab
          icon={gameIcon("devcard")}
          label={t("play.actions.buyDevCard")}
          tooltip={<CostTip label={t("play.actions.buyDevCard")} cost={COSTS.devCard} />}
          description={t("play.actions.costs", { cost: costText(COSTS.devCard, t) })}
          disabled={!c.buyDevCard}
          onClick={() => act({ type: "buyDevCard" })}
        />
        <Fab
          icon={gameIcon("bank")}
          label={t("play.actions.tradeBank")}
          disabled={!c.maritime}
          onClick={() => openDialog("maritime")}
        />
        <Fab
          icon={gameIcon("trade")}
          label={t("play.actions.tradePlayers")}
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
          primary
          ring={ring}
          disabled={!c.endTurn}
          onClick={() => act({ type: "endTurn" })}
        />
      </div>
    </TooltipProvider>
  );
}
