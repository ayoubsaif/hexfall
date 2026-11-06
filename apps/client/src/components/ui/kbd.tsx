// Keycap: a small key label for shortcut hints.
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-ink/10 px-1.5 font-mono text-[11px] leading-5 font-semibold text-foreground shadow-[0_1px_0_var(--color-border)]",
        className,
      )}
      {...props}
    />
  );
}
