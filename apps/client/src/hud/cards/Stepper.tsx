// Count controls with picture cards, shared by the discard, Year of Plenty and trade dialogs
// (specs/hud-presentation "Resource picture cards").
import type { Resource } from "@hexfall/engine";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { resourceLabel } from "../../i18n/labels.ts";
import { GameCard } from "./GameCard.tsx";

/** A − value + control. The labels name what one press changes. */
export function Counter({
  value,
  canAdd,
  lessLabel,
  moreLabel,
  onChange,
  min = 0,
  leather = false,
  disabled = false,
}: {
  value: number;
  canAdd: boolean;
  lessLabel: string;
  moreLabel: string;
  onChange: (next: number) => void;
  /** Lowest value; − is disabled there. */
  min?: number;
  /** Brown leather buttons instead of parchment ones. */
  leather?: boolean;
  disabled?: boolean;
}) {
  const variant = leather ? "default" : "secondary";
  return (
    <span className="flex items-center gap-2">
      <Button
        variant={variant}
        size="icon"
        aria-label={lessLabel}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </Button>
      <span
        className="w-[2ch] text-center text-base font-semibold tabular-nums"
        aria-live="polite"
        data-stepper-value
      >
        {value}
      </span>
      <Button
        variant={variant}
        size="icon"
        aria-label={moreLabel}
        disabled={disabled || !canAdd}
        onClick={() => onChange(value + 1)}
      >
        +
      </Button>
    </span>
  );
}

/** One resource row: its card, its name with an optional note, and a counter. */
export function Stepper({
  resource,
  value,
  note,
  canAdd,
  onChange,
}: {
  resource: Resource;
  value: number;
  note?: string;
  canAdd: boolean;
  onChange: (next: number) => void;
}) {
  const { t } = useTranslation();
  const label = resourceLabel(t, resource);
  return (
    <div className="flex items-center gap-2 py-1" data-resource={resource}>
      <GameCard resource={resource} size="md" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{label}</span>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
      <Counter
        value={value}
        canAdd={canAdd}
        lessLabel={t("dialogs.stepper.less", { resource: label })}
        moreLabel={t("dialogs.stepper.more", { resource: label })}
        onChange={onChange}
      />
    </div>
  );
}
