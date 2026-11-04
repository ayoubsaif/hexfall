// shadcn/ui Card: the translucent HUD panel surface.
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn(
        "pointer-events-auto rounded-xl bg-hud text-foreground shadow-lg shadow-black/25 backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-base font-semibold", className)} {...props} />;
}
