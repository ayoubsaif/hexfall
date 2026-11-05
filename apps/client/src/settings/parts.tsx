// Shared building blocks for settings sections: a labelled row and a single-choice group.
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils.ts";

/** One setting: label and hint on the left, control on the right (stacked when narrow). */
export function SettingRow({
  label,
  hint,
  control,
  htmlFor,
  labelId,
}: {
  label: ReactNode;
  hint?: ReactNode;
  control: ReactNode;
  htmlFor?: string;
  labelId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <label id={labelId} htmlFor={htmlFor} className="block text-sm font-semibold">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export interface Choice<V extends string> {
  value: V;
  label: ReactNode;
  lang?: string;
}

/** Radio group of pill buttons; arrow keys move the choice like native radios. */
export function ChoiceGroup<V extends string>({
  label,
  hint,
  value,
  choices,
  onChange,
  testId,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: V;
  choices: readonly Choice<V>[];
  onChange: (value: V) => void;
  testId?: string;
}) {
  const id = useId();
  const move = (from: number, delta: number, group: HTMLElement | null) => {
    const next = choices[(from + delta + choices.length) % choices.length];
    if (!next) return;
    onChange(next.value);
    group?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };
  return (
    <div className="py-3">
      <p id={`${id}-label`} className="text-sm font-semibold">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        data-testid={testId}
        className="mt-2 flex flex-wrap gap-2"
      >
        {choices.map((c, i) => {
          const checked = c.value === value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              lang={c.lang}
              data-value={c.value}
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className={cn(
                "min-h-9 cursor-pointer rounded-full bg-white/10 px-3.5 text-sm font-semibold text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-checked:bg-primary aria-checked:text-primary-foreground max-sm:min-h-10 motion-reduce:transition-none",
              )}
              onClick={() => onChange(c.value)}
              onKeyDown={(e) => {
                const delta =
                  e.key === "ArrowRight" || e.key === "ArrowDown"
                    ? 1
                    : e.key === "ArrowLeft" || e.key === "ArrowUp"
                      ? -1
                      : 0;
                if (delta === 0) return;
                e.preventDefault();
                move(i, delta, e.currentTarget.parentElement);
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
