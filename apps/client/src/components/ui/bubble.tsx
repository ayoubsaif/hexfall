// shadcn/ui Bubble: the visible surface of one chat message (styled for the parchment HUD).
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export function Bubble({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble"
      className={cn(
        "group/bubble relative max-w-full rounded-2xl border border-ink/15 bg-cream/70 px-3 py-1.5 text-sm leading-snug text-ink shadow-sm shadow-black/10 group-data-[align=end]/message:rounded-br-sm group-data-[align=end]/message:border-leather/40 group-data-[align=end]/message:bg-leather group-data-[align=end]/message:text-cream group-data-[align=start]/message:rounded-bl-sm",
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
