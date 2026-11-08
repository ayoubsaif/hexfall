// A row of parchment buttons to pick one option: the game-styled stand-in for a <select>.
// Behaves as a radio group: arrow keys move and pick, only the picked option is tabbable.
import { type KeyboardEvent, useRef } from "react";
import { cn } from "@/lib/utils.ts";
import { Button } from "./button.tsx";

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
}

export function ChoiceGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  size = "default",
  className,
  ...rest
}: {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  disabled?: boolean;
  size?: "default" | "sm";
  className?: string;
  "data-testid"?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0 || disabled) return;
    e.preventDefault();
    const next = (current + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn("flex flex-wrap gap-1.5", className)}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {options.map((o, i) => {
        const selected = i === current;
        return (
          <Button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            data-selected={selected || undefined}
            tabIndex={selected ? 0 : -1}
            variant="secondary"
            size={size}
            disabled={disabled}
            className="flex-1 px-2.5"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}
