// shadcn/ui Bubble: the visible surface of one chat message (a square card block, like the HUD cards).
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export function Bubble({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble"
      className={cn(
        "group/bubble relative max-w-full rounded-none border-2 border-leather bg-hud-solid px-3 py-1.5 text-sm leading-snug text-ink shadow-[0_2px_0_rgb(74_44_26/45%)] group-data-[align=end]/message:border-[#2a160b] group-data-[align=end]/message:bg-leather group-data-[align=end]/message:text-cream",
        className,
      )}
      {...props}
    />
  );
}

export function BubbleContent({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="bubble-content"
      className={cn("m-0 break-words whitespace-pre-wrap", className)}
      {...props}
    />
  );
}
