// On/off switch (role="switch"): parchment groove when off, brown leather with a brass knob
// when on (`.hud-switch` in style.css). A native <button>, so Space and Enter toggle it.
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
      className={cn("hud-switch", className)}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      <span aria-hidden className="hud-switch-knob" />
    </button>
  );
}
