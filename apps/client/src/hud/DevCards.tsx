// The viewer's development cards and plays (specs/game-hud, "Own hand", "Development card plays";
// specs/hud-presentation "Development cards as cards"). Rendered inside the edge hand (Hand.tsx).
import type { DevCard, PlayableDevCard } from "@hexfall/engine";
import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import { GameCard } from "./cards/GameCard.tsx";
import { controlsOf } from "../game/status.ts";
import type { T } from "../i18n/index.ts";
import { devCardLabel } from "../i18n/labels.ts";
import { act } from "../net/actions.ts";
import { openDialog, useUiStore } from "../store/ui.ts";
import { useTutorial } from "../store/tutorial.ts";
import { type Blocker, blockerFor } from "../tutorial/blockers.ts";
import { useInFlight, useLegal, useOwn, useView } from "./state.ts";
import { TutorialHelp } from "./tutorial/TutorialHelp.tsx";

const ORDER: DevCard[] = ["knight", "roadBuilding", "yearOfPlenty", "monopoly", "victoryPoint"];

export interface CardGroup {
  card: DevCard;
  count: number;
  /** Bought this turn (not playable until next turn; VP cards excepted). */
  fresh: number;
}

/** Groups a hand of development cards by type, counting cards bought this turn. */
export function groupCards(cards: readonly DevCard[], bought: readonly DevCard[]): CardGroup[] {
  return ORDER.flatMap((card) => {
    const count = cards.filter((c) => c === card).length;
    if (count === 0) return [];
    const fresh = Math.min(count, bought.filter((c) => c === card).length);
    return [{ card, count, fresh }];
  });
}

function play(card: PlayableDevCard): void {
  switch (card) {
    case "knight":
      act({ type: "playKnight" });
      break;
    case "roadBuilding":
      act({ type: "playRoadBuilding" });
      break;
    case "yearOfPlenty":
      openDialog("yearOfPlenty");
      break;
    case "monopoly":
      openDialog("monopoly");
      break;
  }
}

/** Why a held card can't be played right now (accessible description), or undefined. */
export function blockedReason(group: CardGroup, playable: boolean, t: T): string | undefined {
  if (playable) return undefined;
  if (group.fresh === group.count) return t("play.dev.boughtThisTurn");
  return t("play.dev.notPlayable");
}

/** Tooltip gap above a slot so it clears the fanned-out stack (10 % of a ~100 px card per extra card). */
export const fanOffset = (count: number): number => 4 + Math.min(Math.max(count - 1, 0), 8) * 10;

/**
 * A slot's popup: the plain tooltip, or the tutorial rule helper instead while tutorial mode is
 * on (one popup at a time; openspec tutorial-mode-and-rules-guide design decision 3).
 */
function SlotTip({
  card,
  count,
  tip,
  blocker,
  children,
}: {
  card: DevCard;
  count: number;
  tip: ReactNode;
  blocker: Blocker | null;
  children: ReactElement;
}) {
  const tutorial = useTutorial((s) => s.enabled);
  if (tutorial) {
    return (
      <TutorialHelp topic={card} blocker={blocker}>
        {children}
      </TutorialHelp>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={fanOffset(count)} className="pointer-events-none">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

/** Hand slot: 80 % visible above the screen edge, rising fully on hover or keyboard focus. */
export const HAND_SLOT =
  "group/slot pointer-events-auto relative translate-y-[20%] transition-[translate] duration-200 hover:z-10 hover:translate-y-0 focus-within:z-10 focus-within:translate-y-0 motion-reduce:transition-none";

/**
 * The viewer's development cards as edge-hand slots (`<li>`s for Hand's row), or nothing when
 * they hold none: no panel, no empty text. While the your-turn focus is open, playable cards sit
 * above its overlay (z-40) so a Knight can be played before the roll.
 */
export function DevCards() {
  const view = useView();
  const legal = useLegal();
  const inFlight = useInFlight();
  const own = useOwn();
  const focusOpen = useUiStore((s) => s.focus === "open");
  const { t } = useTranslation();
  if (!view || !own?.devCards) return null;
  const c = controlsOf(view, legal, inFlight);
  const groups = groupCards(own.devCards, own.boughtThisTurn ?? []);
  if (groups.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      {groups.map((g, i) => {
        const card = devCardLabel(t, g.card);
        const label =
          g.count > 1
            ? t("play.dev.playHeld", { card, count: g.count })
            : t("play.dev.play", { card });
        const first = i === 0 || undefined;
        if (g.card === "victoryPoint") {
          return (
            <SlotTip key={g.card} card={g.card} count={g.count} tip={card} blocker={null}>
              <li data-card={g.card} data-dev-start={first} className={HAND_SLOT}>
                <GameCard hideName dev="victoryPoint" count={g.count} layout="peek" tabIndex={0} />
                {c.revealVictoryPoints && (
                  <Button
                    size="sm"
                    className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2"
                    onClick={() => act({ type: "revealVictoryPoints" })}
                  >
                    {t("play.dev.revealToWin")}
                  </Button>
                )}
              </li>
            </SlotTip>
          );
        }
        const playable = c.devCards.includes(g.card as PlayableDevCard);
        const reason = blockedReason(g, playable, t);
        return (
          <SlotTip
            key={g.card}
            card={g.card}
            count={g.count}
            tip={reason === undefined ? card : `${card} · ${reason}`}
            blocker={playable ? null : blockerFor(g.card as PlayableDevCard, view, legal)}
          >
            <li
              data-card={g.card}
              data-fresh={g.fresh > 0 || undefined}
              data-dev-start={first}
              className={cn(
                HAND_SLOT,
                playable && focusOpen && "z-40 hover:z-40 focus-within:z-40",
              )}
            >
              <GameCard
                hideName
                dev={g.card}
                count={g.count}
                layout="peek"
                label={label}
                disabled={!playable}
                {...(reason === undefined ? {} : { description: reason })}
                onClick={() => play(g.card as PlayableDevCard)}
              />
            </li>
          </SlotTip>
        );
      })}
    </TooltipProvider>
  );
}
