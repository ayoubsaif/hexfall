// Round floating icon button (specs/game-hud "Turn status and controls"; design decision 6):
// no surrounding panel, an accessible name, a tooltip, an optional badge (pieces left) and an
// optional countdown ring. The ring steps once per second with the countdown: its
// stroke-dashoffset is set per tick and it never has a CSS transition or animation.
import type { LucideIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";

export interface FabRing {
  /** Time left as a share of the wait, 0–1. */
  fraction: number;
  warning: boolean;
  /** Accessible text, e.g. "45 seconds left". */
  text: string;
}

/** Ring geometry in the SVG's 100 × 100 viewBox. */
const R = 46;
export const RING_CIRCUMFERENCE = 2 * Math.PI * R;

/** Dash offset for a ring `fraction` full (0: empty, 1: full). */
export function ringOffset(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return RING_CIRCUMFERENCE * (1 - f);
}

export type FabProps = Omit<ComponentProps<"button">, "children" | "aria-label"> & {
  icon: LucideIcon;
  /** Accessible name and default tooltip. */
  label: string;
  /** Tooltip content (defaults to the label). */
  tooltip?: ReactNode;
  /** Small count at the top right (visual; put it in `description` for assistive tech). */
  badge?: ReactNode;
  /** Accessible description (e.g. the cost and pieces left). */
  description?: string;
  ring?: FabRing | null;
  /** The primary action: accent color and a larger button. */
  primary?: boolean;
};

export function Fab({
  icon: Icon,
  label,
  tooltip,
  badge,
  description,
  ring = null,
  primary = false,
  className,
  ...props
}: FabProps) {
  const id = useId();
  const desc = [description, ring?.text].filter(Boolean).join(". ");
  return (
    <Tooltip>
      {/* The wrapper is the trigger so a disabled button still shows its tooltip on hover. */}
      <TooltipTrigger asChild>
        <span className="pointer-events-auto relative inline-flex shrink-0" data-fab>
          <button
            type="button"
            aria-label={label}
            aria-describedby={desc ? id : undefined}
            data-primary={primary || undefined}
            className={cn(
              "relative inline-flex cursor-pointer items-center justify-center shadow-lg shadow-black/30 outline-none",
              "transition-[translate,background-color,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
              "hover:-translate-y-0.5 disabled:pointer-events-none disabled:cursor-default disabled:opacity-50",
              primary
                ? "size-14 hud-leather-round max-sm:size-12 short:size-12"
                : "size-12 hud-leather-round max-sm:size-11 short:size-11",
              "aria-pressed:bg-primary aria-pressed:text-primary-foreground",
              className,
            )}
            {...props}
          >
            <Icon aria-hidden="true" strokeWidth={2} className={primary ? "size-9" : "size-8"} />
            {ring && (
              <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                className={cn(
                  "pointer-events-none absolute -inset-1 size-[calc(100%+0.5rem)] -rotate-90",
                  ring.warning ? "text-bad" : "text-hud-fg",
                )}
                data-warning={ring.warning || undefined}
              >
                <circle
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.2}
                  strokeWidth={5}
                />
                <circle
                  data-fab-ring
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset(ring.fraction)}
                />
              </svg>
            )}
          </button>
          {badge !== undefined && badge !== null && (
            <span
              aria-hidden="true"
              data-fab-badge
              className="pointer-events-none absolute -top-1 -right-1 min-w-[18px] rounded-full bg-hud-solid px-1 text-center text-[11px] leading-[18px] font-semibold text-hud-fg tabular-nums shadow shadow-black/40"
            >
              {badge}
            </span>
          )}
          {desc && (
            <span id={id} className="sr-only">
              {desc}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}
