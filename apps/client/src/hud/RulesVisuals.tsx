// Visual aids for the rules guide (openspec tutorial-mode-and-rules-guide, specs/rules-guide
// "Rules guide content"): each section shows the real game pieces it talks about — resource and
// development cards, piece icons, costs, dice, trade rates and victory points — next to the text.
// Everything here is decorative support for the text; the section text stays the full rule.
import type { DevCard, Resource } from "@hexfall/engine";
import { COSTS } from "@hexfall/engine/geometry";
import { CARD_ORDER } from "../game/cardOrder.ts";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import type { en } from "../i18n/locales/index.ts";
import type { RulesSection } from "../store/rulesGuide.ts";
import { CostCards } from "./actions/ActionButtons.tsx";
import { GameCard } from "./cards/GameCard.tsx";
import { DiceArt } from "./dice/DiceArt.tsx";
import { type GameIconName, gameIcon } from "./GameIcon.tsx";

const DEV_DECK: readonly { card: DevCard; count: number }[] = [
  { card: "knight", count: 14 },
  { card: "roadBuilding", count: 2 },
  { card: "yearOfPlenty", count: 2 },
  { card: "monopoly", count: 2 },
  { card: "victoryPoint", count: 5 },
];

/** Times out of 36 each sum is rolled. */
export const ROLL_WAYS = (n: number) => 6 - Math.abs(7 - n);

function Icon({ name, className }: { name: GameIconName; className?: string }) {
  const I = gameIcon(name);
  return <I className={cn("size-9 shrink-0", className)} />;
}

/** One labelled item of a visual strip. */
function Item({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <figure className="m-0 flex min-w-0 flex-col items-center gap-1 text-center">
      <div className="flex min-h-10 items-end justify-center gap-0.5">{children}</div>
      <figcaption className="max-w-[9rem] text-xs leading-tight text-ink-muted">{label}</figcaption>
    </figure>
  );
}

function Arrow() {
  return <ArrowRight aria-hidden className="size-4 shrink-0 self-center text-gold" />;
}

/** Number token chip with its probability dots (6 and 8 in red). */
function Token({ n }: { n: number }) {
  const red = n === 6 || n === 8;
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full border border-gold/70 bg-cream font-serif text-sm font-bold shadow-sm",
          red ? "text-bad" : "text-ink",
        )}
      >
        {n}
      </span>
      <span className="flex gap-px" aria-hidden>
        {Array.from({ length: ROLL_WAYS(n) }, (_, i) => (
          <span key={i} className={cn("size-1 rounded-full", red ? "bg-bad" : "bg-ink/70")} />
        ))}
      </span>
    </span>
  );
}

/** "×n" badge beside a picture. */
function Times({ n }: { n: number | string }) {
  return <span className="self-center text-sm font-semibold tabular-nums">×{n}</span>;
}

function VpBadge({ n }: { n: number }) {
  return (
    <span className="ml-0.5 self-center rounded-sm bg-leather px-1 text-[11px] leading-4 font-semibold text-cream tabular-nums">
      {n} VP
    </span>
  );
}

function Cards({ resource, n }: { resource: Resource; n: number }) {
  return (
    <span className="flex -space-x-3">
      {Array.from({ length: n }, (_, i) => (
        <GameCard key={i} resource={resource} size="sm" />
      ))}
    </span>
  );
}

function Strip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-testid="rules-visual"
      className={cn(
        "flex flex-wrap items-end justify-center gap-x-4 gap-y-3 border border-gold/40 bg-cream/50 px-3 py-3 sm:justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function RulesVisual({ section }: { section: RulesSection }) {
  const { t } = useTranslation();
  const v = (k: keyof typeof en.rules.visual) => t(`rules.visual.${k}`);
  switch (section) {
    case "goal":
      return (
        <div className="flex flex-col gap-2">
          <Strip>
            {CARD_ORDER.map((r) => (
              <GameCard key={r} resource={r} size="md" />
            ))}
          </Strip>
          <Strip>
            <Item label={v("roads")}>
              <Icon name="road" />
              <Times n={15} />
            </Item>
            <Item label={v("settlements")}>
              <Icon name="settlement" />
              <Times n={5} />
            </Item>
            <Item label={v("cities")}>
              <Icon name="city" />
              <Times n={4} />
            </Item>
            <Item label={v("goalVp")}>
              <Icon name="vp" />
              <span className="self-center font-serif text-xl font-bold">10</span>
            </Item>
          </Strip>
        </div>
      );
    case "setup":
      return (
        <Strip>
          <Item label={v("round1")}>
            <Icon name="settlement" />
            <Icon name="road" className="size-7" />
          </Item>
          <Arrow />
          <Item label={v("round2")}>
            <Icon name="settlement" />
            <Icon name="road" className="size-7" />
          </Item>
          <Arrow />
          <Item label={v("startCards")}>
            <GameCard resource="lumber" size="sm" />
            <GameCard resource="grain" size="sm" />
            <GameCard resource="ore" size="sm" />
          </Item>
        </Strip>
      );
    case "turn":
      return (
        <Strip>
          <Item label={v("roll")}>
            <DiceArt dice={[5, 3]} className="h-10 w-12" />
          </Item>
          <Arrow />
          <Item label={v("trade")}>
            <Icon name="trade" />
            <Icon name="bank" />
          </Item>
          <Arrow />
          <Item label={v("build")}>
            <Icon name="road" className="size-7" />
            <Icon name="settlement" className="size-8" />
            <Icon name="city" />
            <Icon name="devcard" className="size-8" />
          </Item>
          <Arrow />
          <Item label={v("end")}>
            <Icon name="endturn" />
          </Item>
        </Strip>
      );
    case "production":
      return (
        <div className="flex flex-col gap-2">
          <Strip>
            <Item label={v("perSettlement")}>
              <Icon name="settlement" />
              <Arrow />
              <Cards resource="grain" n={1} />
            </Item>
            <Item label={v("perCity")}>
              <Icon name="city" />
              <Arrow />
              <Cards resource="grain" n={2} />
            </Item>
          </Strip>
          <Strip className="gap-x-2.5">
            <p className="m-0 w-full text-center text-xs text-ink-muted sm:text-left">
              {v("odds")}
            </p>
            {[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => (
              <Token key={n} n={n} />
            ))}
          </Strip>
        </div>
      );
    case "building":
      return (
        <Strip className="flex-col items-stretch gap-y-2 sm:items-stretch">
          {(
            [
              ["road", "road", COSTS.road, 0],
              ["settlement", "settlement", COSTS.settlement, 1],
              ["city", "city", COSTS.city, 2],
              ["devCard", "devcard", COSTS.devCard, 0],
            ] as const
          ).map(([key, icon, cost, vp]) => (
            <div key={key} className="flex items-center gap-2">
              <Icon name={icon} className="size-8" />
              <span className="w-28 shrink-0 text-sm font-semibold">{v(key)}</span>
              <CostCards cost={cost} />
              {vp > 0 && <VpBadge n={vp} />}
            </div>
          ))}
        </Strip>
      );
    case "robber":
      return (
        <Strip>
          <Item label={v("sevenRolled")}>
            <DiceArt dice={[3, 4]} className="h-10 w-12" />
          </Item>
          <Arrow />
          <Item label={v("discardHalf")}>
            <span className="flex -space-x-3.5">
              {(["brick", "wool", "grain", "ore", "brick", "wool", "wool", "grain"] as const).map(
                (r, i) => (
                  <GameCard
                    key={i}
                    resource={r}
                    size="sm"
                    className={i >= 4 ? "translate-y-1.5 opacity-35" : ""}
                  />
                ),
              )}
            </span>
          </Item>
          <Arrow />
          <Item label={v("moveRobber")}>
            <span
              aria-hidden
              className="grid h-10 w-9 place-items-center bg-[#d9bd84] [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
            >
              <span className="h-6 w-3.5 rounded-t-full bg-[#2c2a2a]" />
            </span>
          </Item>
          <Arrow />
          <Item label={v("steal")}>
            <Icon name="hand" />
            <GameCard resource="ore" size="sm" />
          </Item>
        </Strip>
      );
    case "devCards":
      return (
        <Strip>
          {DEV_DECK.map(({ card, count }) => (
            <Item key={card} label={`×${count}`}>
              <GameCard dev={card} size="md" />
            </Item>
          ))}
        </Strip>
      );
    case "trading":
      return (
        <Strip className="flex-col items-stretch gap-y-2 sm:items-stretch">
          {(
            [
              ["bank", "bank", 4, "wool"],
              ["harbor3", "trade", 3, "brick"],
              ["harbor2", "trade", 2, "ore"],
            ] as const
          ).map(([key, icon, n, give]) => (
            <div key={key} className="flex items-center gap-2">
              <Icon name={icon} className="size-8" />
              <span className="w-24 shrink-0 text-sm font-semibold">{v(key)}</span>
              <Cards resource={give} n={n} />
              <Arrow />
              <GameCard resource="grain" size="sm" />
            </div>
          ))}
        </Strip>
      );
    case "special":
      return (
        <Strip>
          <Item label={v("longestRoadReq")}>
            <span className="flex -space-x-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Icon key={i} name="road" className="size-7" />
              ))}
            </span>
          </Item>
          <Item label={v("longestRoad")}>
            <VpBadge n={2} />
          </Item>
          <Item label={v("largestArmyReq")}>
            <span className="flex -space-x-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Icon key={i} name="knight" />
              ))}
            </span>
          </Item>
          <Item label={v("largestArmy")}>
            <VpBadge n={2} />
          </Item>
        </Strip>
      );
    case "winning":
      return (
        <Strip>
          {(
            [
              ["settlement", "settlement", 1],
              ["city", "city", 2],
              ["longestRoad", "road", 2],
              ["largestArmy", "knight", 2],
              ["vpCard", "vp", 1],
            ] as const
          ).map(([key, icon, vp]) => (
            <Item key={key} label={v(key)}>
              <Icon name={icon} className="size-8" />
              <VpBadge n={vp} />
            </Item>
          ))}
          <Arrow />
          <Item label={v("total")}>
            <span className="font-serif text-2xl font-bold text-forest">10</span>
          </Item>
        </Strip>
      );
  }
}
