// A resource or development card drawn like a physical card (specs/hud-presentation
// "Resource picture cards", "Development cards as cards", "Card accessibility";
// design decisions 5 and 6).
import type { DevCard, Resource } from "@hexfall/engine";
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

/** URL of a resource's painted icon (public/ui/resources, transparent 128 px). */
export function resourceIconUrl(resource: Resource): string {
  return `${APP_BASE.endsWith("/") ? APP_BASE : `${APP_BASE}/`}ui/resources/${resource}.webp`;
}

/** URL of a development card's painted art (public/cards/dev, made by tools/dev-cards-gen.mjs). */
export function devCardArtUrl(card: DevCard): string {
  return `${APP_BASE.endsWith("/") ? APP_BASE : `${APP_BASE}/`}cards/dev/${card}.webp`;
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

/** Most ghost cards drawn when a stack fans out; the count badge still shows the exact number. */
const MAX_FAN = 8;

const SIZE: Record<CardSize, string> = {
  sm: "w-7 rounded-md p-px",
  md: "w-14 rounded-xl p-[3px]",
  lg: "w-[72px] rounded-xl p-1 max-sm:w-[52px] short:w-[52px]",
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
  /** Hide the name strip (the hand shows the name in a tooltip instead). */
  hideName?: boolean;
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
    hideName = false,
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

  const faceStyle: CSSProperties = props.resource
    ? {
        // Tinted face in the resource color; the icon sits on top (no terrain art).
        backgroundImage: `radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--frame) 55%, white) 0%, var(--frame) 70%, color-mix(in srgb, var(--frame) 70%, black) 100%)`,
      }
    : { backgroundImage: `url(${devCardArtUrl(props.dev)})` };
  // Peek cards held in twos or more fan out upward when their hand slot is hovered or focused:
  // one ghost per extra card, each rising a further 20 % of the card height behind the one in front.
  const ghosts = peek && count !== undefined ? Math.min(Math.max(count - 1, 0), MAX_FAN) : 0;

  const body = (
    <>
      {Array.from({ length: ghosts }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          data-card-ghost
          className="pointer-events-none absolute inset-0 -z-10 translate-y-0 rounded-xl bg-[var(--frame)] p-1 opacity-0 shadow-md shadow-black/30 transition-[translate,opacity] duration-200 group-focus-within/slot:translate-y-[calc(var(--k)*-20%)] group-focus-within/slot:opacity-100 group-hover/slot:translate-y-[calc(var(--k)*-20%)] group-hover/slot:opacity-100 motion-reduce:transition-none max-sm:p-[3px]"
          style={{ "--k": i + 1, transitionDelay: `${i * 25}ms` } as CSSProperties}
        >
          <span
            className="block aspect-[5/7] w-full rounded-lg bg-black/40 bg-cover bg-center"
            style={faceStyle}
          />
        </span>
      ))}
      <span
        aria-hidden="true"
        data-card-art
        className={cn(
          "relative flex aspect-[5/7] w-full justify-center overflow-hidden bg-black/40 bg-cover bg-center",
          // Peek: icon centered in the upper half, below the top name strip.
          peek ? "items-start pt-[24%] max-sm:pt-[28%] short:pt-[28%]" : "items-center",
          size === "sm" ? "rounded-[5px]" : "rounded-lg",
        )}
        style={faceStyle}
      >
        {props.resource && (
          <img
            src={resourceIconUrl(props.resource)}
            alt=""
            width={128}
            height={128}
            draggable={false}
            data-resource-icon
            className={cn(
              "pointer-events-none w-[78%] drop-shadow-[0_2px_2px_rgb(0_0_0/45%)]",
              peek && "mt-0",
            )}
          />
        )}
        <span
          className={cn(
            "absolute inset-x-0 bg-hud-solid/90 py-px text-center leading-tight font-semibold tracking-wide text-hud-fg uppercase",
            peek ? "top-0" : "bottom-0",
            hideName ? "hidden" : NAME[size],
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
