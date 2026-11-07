// shadcn/ui Message: one line of a conversation (avatar, aligned content, header, footer).
// Render the visible surface inside MessageContent with <Bubble>.
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export function MessageGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="message-group" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

export function Message({
  align = "start",
  className,
  ...props
}: ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message flex w-full items-end gap-2 data-[align=end]:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}

export function MessageAvatar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="message-avatar" className={cn("shrink-0 self-end", className)} {...props} />
  );
}

export function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex min-w-0 max-w-[80%] flex-col gap-0.5 group-data-[align=end]/message:items-end",
        className,
      )}
      {...props}
    />
  );
}

export function MessageHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn("px-1 text-xs font-semibold text-ink-muted", className)}
      {...props}
    />
  );
}

export function MessageFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn("px-1 text-[11px] text-ink-muted", className)}
      {...props}
    />
  );
}
