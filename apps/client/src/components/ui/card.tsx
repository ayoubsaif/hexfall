// shadcn/ui Card: the translucent HUD panel surface.
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn(
        "pointer-events-auto frame [--corner-size:14px] paper rounded-none text-foreground backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2 className={cn("hud-leather hud-title block text-center font-serif text-lg leading-tight font-semibold", className)} {...props} />
  );
}
