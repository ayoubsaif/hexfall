// The viewer's hand at the bottom screen edge (specs/game-hud "Own hand"; specs/hud-presentation
// "Responsive HUD layout", "Development cards as cards"; design decision 7): resource cards, then
// any held development cards, each about half hidden below the edge and rising on hover or
// keyboard focus. No panel: one soft radial shadow behind the row. Pieces left are shown on the
// build buttons (hud/actions/ActionButtons.tsx).
import type { Resource } from "@hexfall/engine";
import { RESOURCES } from "@hexfall/engine/geometry";
import type { CSSProperties, Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { resourceLabel } from "../i18n/labels.ts";
import { GameCard } from "./cards/GameCard.tsx";
import { useCountChange } from "./cards/useCountChange.ts";
import { DevCards, HAND_SLOT, groupCards } from "./DevCards.tsx";
import { useOwn } from "./state.ts";

/** One fixed resource slot: the resource's card, stacked by count, dimmed at zero. */
function HandSlot({ resource, count }: { resource: Resource; count: number }) {
  const change = useCountChange(count);
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li data-resource={resource} data-empty={count === 0 || undefined} className={HAND_SLOT}>
          <GameCard
            hideName
            key={change.key}
            resource={resource}
            count={count}
            dimmed={count === 0}
            animation={change.animation}
            layout="peek"
            // Focusable so keyboard users can raise it; it reads "Brick, 3".
            tabIndex={0}
          />
        </li>
      </TooltipTrigger>
      <TooltipContent side="top" className="pointer-events-none">
        {resourceLabel(t, resource)}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Mount while a game view is present. Nothing here may set `filter`, `opacity`, `transform` or
 * `z-index` on the row's ancestors: the slots' z-index must compete with the your-turn overlay
 * in the HUD root's stacking context.
 */
export function Hand({ ref }: { ref?: Ref<HTMLDivElement> }) {
  const own = useOwn();
  const { t } = useTranslation();
  if (!own?.resources) return null;
  const res = own.resources;
  const devGroups = own.devCards ? groupCards(own.devCards, own.boughtThisTurn ?? []).length : 0;
  const slots = RESOURCES.length + devGroups;
  return (
    <TooltipProvider delayDuration={150}>
      <div
        ref={ref}
        role="group"
        aria-label={t("play.hand.label")}
        data-testid="hand"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
      >
        <div className="relative flex">
          <span aria-hidden="true" data-hand-shadow className="hand-shadow" />
          <ul
            className="edge-hand m-0 flex list-none items-end p-0"
            style={{ "--n": slots } as CSSProperties}
          >
            {RESOURCES.map((r) => (
              <HandSlot key={r} resource={r} count={res[r]} />
            ))}
            <DevCards />
          </ul>
        </div>
      </div>
    </TooltipProvider>
  );
}
