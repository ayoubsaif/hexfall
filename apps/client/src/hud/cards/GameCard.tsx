// A resource or development card drawn like a physical card (specs/hud-presentation
// "Resource picture cards", "Development cards as cards", "Card accessibility";
// design decisions 5 and 6).
import type { DevCard, Resource } from "@hexfall/engine";
import { Coins, Gift, type LucideIcon, Route, Shield, Trophy } from "lucide-react";
import { type CSSProperties, type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import type { T } from "../../i18n/index.ts";
import { devCardLabel, resourceLabel } from "../../i18n/labels.ts";
import { type CardAnimation, animationClass } from "./useCountChange.ts";

export type CardSize = "sm" | "md" | "lg";

/**
 * "default": name strip along the bottom, icon centered (dialogs, cost hints).
 * "peek": for the edge hand, where the lower half is hidden below the screen edge: name strip
 * at the top and the icon in the upper half; the count badge stays at the top right.
 */
export type CardLayout = "default" | "peek";

const APP_BASE: string = import.meta.env.BASE_URL ?? "/";

/** URL of a resource's card art (public/cards, built by `pnpm run cards:build`). */
export function cardArtUrl(resource: Resource): string {
  return `${APP_BASE.endsWith("/") ? APP_BASE : `${APP_BASE}/`}cards/${resource}.webp`;
}

/** Frame color per resource (theme tokens in style.css). */
export const RESOURCE_FRAME: Readonly<Record<Resource, string>> = {
  brick: "var(--color-res-brick)",
  grain: "var(--color-res-grain)",
  lumber: "var(--color-res-lumber)",
  ore: "var(--color-res-ore)",
  wool: "var(--color-res-wool)",
};

const DEV_FRAME = "#4b4f7a";

export const DEV_ICON: Readonly<Record<DevCard, LucideIcon>> = {
  knight: Shield,
  roadBuilding: Route,
  yearOfPlenty: Gift,
  monopoly: Coins,
  victoryPoint: Trophy,
};

const SIZE: Record<CardSize, string> = {
  sm: "w-7 rounded-[3px] p-px",
  md: "w-14 rounded-md p-[3px]",
  lg: "w-[72px] rounded-lg p-1 max-sm:w-[52px] short:w-[52px]",
};

const NAME: Record<CardSize, string> = {
  sm: "hidden",
  md: "text-[9px]",
  lg: "text-[10px] max-sm:text-[9px] short:text-[9px]",
};

type Face = { resource: Resource; dev?: undefined } | { dev: DevCard; resource?: undefined };

export type GameCardProps = Face & {
  size?: CardSize;
  layout?: CardLayout;
  /** Makes a non-interactive card focusable (the edge hand raises it on focus). */
  tabIndex?: number;
  /** Count shown as a badge (and in the accessible name). */
  count?: number;
  /** Draw the badge even for a count of 1 (dialogs show "×1"). */
  alwaysShowCount?: boolean;
  /** Held none: shown but faded. */
  dimmed?: boolean;
  /** For interactive cards: visible but not playable. */
  disabled?: boolean;
  /** Makes the card a button. */
  onClick?: () => void;
  /** Accessible description (e.g. why a card can't be played). */
  description?: string;
  /** Overrides the accessible name (default "Name" or "Name, count"). */
  label?: string;
  animation?: CardAnimation;
  className?: string;
  children?: ReactNode;
};

/** Accessible name: "Brick, 3", or just "Brick" without a count. */
export function cardLabel(name: string, count: number | undefined, t: T): string {
  return count === undefined ? name : t("play.card.withCount", { name, count });
}

export function GameCard(props: GameCardProps) {
  const {
    size = "lg",
    layout = "default",
    tabIndex,
    count,
    alwaysShowCount = false,
    dimmed = false,
    disabled = false,
    onClick,
    description,
    animation = null,
    className,
    children,
  } = props;
  const { t } = useTranslation();
  const name = props.resource ? resourceLabel(t, props.resource) : devCardLabel(t, props.dev);
  const frame = props.resource ? RESOURCE_FRAME[props.resource] : DEV_FRAME;
  const label = props.label ?? cardLabel(name, count, t);
  const interactive = onClick !== undefined;
  const stacked = count !== undefined && count >= 2 && size !== "sm";
  const showBadge = count !== undefined && (count >= 2 || (alwaysShowCount && count >= 1));
  const Icon = props.dev ? DEV_ICON[props.dev] : undefined;
  const uid = useId();
  const descId = description ? `${uid}-desc` : undefined;
  const peek = layout === "peek";

  const style = {
    "--frame": frame,
    // Up to three offset card edges behind the face card for a stack (decision 6).
    boxShadow: stacked
      ? count >= 3
        ? "3px -3px 0 -1px var(--frame), 6px -6px 0 -2px color-mix(in srgb, var(--frame) 80%, black)"
        : "3px -3px 0 -1px var(--frame)"
      : undefined,
  } as CSSProperties;

  const body = (
    <>
      <span
        aria-hidden="true"
        data-card-art
        className={cn(
          "relative flex aspect-[5/7] w-full justify-center overflow-hidden bg-black/40 bg-cover bg-center",
          // Peek: icon centered in the upper half, below the top name strip.
          peek ? "items-start pt-[24%] max-sm:pt-[28%] short:pt-[28%]" : "items-center",
          size === "sm" ? "rounded-[2px]" : "rounded-[4px]",
        )}
        style={
          props.resource ? { backgroundImage: `url(${cardArtUrl(props.resource)})` } : undefined
        }
      >
        {Icon && (
          <Icon
            data-card-icon
            className={cn(
              "text-hud-fg/90",
              size === "sm"
                ? "size-3.5"
                : size === "md"
                  ? "size-6"
                  : "size-7 max-sm:size-5 short:size-5",
            )}
            strokeWidth={1.75}
          />
        )}
        <span
          className={cn(
            "absolute inset-x-0 bg-hud-solid/90 py-px text-center leading-tight font-semibold tracking-wide text-hud-fg uppercase",
            peek ? "top-0" : "bottom-0",
            NAME[size],
          )}
          data-card-name
        >
          {name}
        </span>
      </span>
      <span className="sr-only">{label}</span>
      {showBadge && (
        <Badge
          aria-hidden="true"
          variant="accent"
          className="absolute -top-1.5 -right-1.5 shadow shadow-black/40"
        >
          {count}
        </Badge>
      )}
      {children}
      {descId && (
        <span id={descId} className="sr-only">
          {description}
        </span>
      )}
    </>
  );

  const classes = cn(
    tabIndex !== undefined && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "relative inline-block shrink-0 bg-[var(--frame)] align-top shadow-md shadow-black/30 select-none",
    SIZE[size],
    dimmed && "opacity-35 saturate-50",
    animationClass(animation),
    className,
  );

  if (interactive) {
    return (
      <button
        type="button"
        data-card={props.resource ?? props.dev}
        data-layout={layout}
        className={cn(
          classes,
          "pointer-events-auto cursor-pointer transition-transform duration-150 outline-none hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50 disabled:hover:translate-y-0",
        )}
        style={style}
        disabled={disabled}
        onClick={onClick}
        aria-describedby={descId}
      >
        {body}
      </button>
    );
  }
  return (
    <span
      data-card={props.resource ?? props.dev}
      data-layout={layout}
      data-dimmed={dimmed || undefined}
      tabIndex={tabIndex}
      className={classes}
      style={style}
      aria-describedby={descId}
    >
      {body}
    </span>
  );
}
