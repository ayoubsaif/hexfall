// A radio option drawn as a parchment circle that takes a red wax seal when picked. The real
// <input type="radio"> stays in the page (visually hidden) for keyboard and screen readers.
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

export function SealRadio({
  children,
  className,
  ...input
}: Omit<ComponentProps<"input">, "type" | "children"> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-8 cursor-pointer items-center gap-2.5 max-sm:min-h-10 has-[:checked]:font-semibold has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className,
      )}
    >
      <input type="radio" className="peer sr-only" {...input} />
      <span aria-hidden="true" className="seal-radio" />
      <span>{children}</span>
    </label>
  );
}
