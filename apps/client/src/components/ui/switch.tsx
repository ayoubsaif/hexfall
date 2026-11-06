// Small on/off switch (role="switch") in the HUD palette.
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-ink/25 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-checked:bg-forest motion-reduce:transition-none",
        className,
      )}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-cream shadow transition-transform duration-150 group-aria-checked:translate-x-[22px] motion-reduce:transition-none"
      />
    </button>
  );
}
