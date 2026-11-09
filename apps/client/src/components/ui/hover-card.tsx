// Hover card on Radix HoverCard, portalled into the HUD root (openspec
// tutorial-mode-and-rules-guide, specs/hover-cards; design decision 2). Mouse: opens after 300 ms
// of hover, closes 150 ms after leaving. Keyboard: opens on focus, Escape closes. Touch: opens on
// a 450 ms press-and-hold (the tap action is not fired) and closes on a tap outside.
import { HoverCard as HoverCardPrimitive } from "radix-ui";
import { type ReactElement, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils.ts";
import { useLongPress } from "@/hooks/use-long-press.ts";
import { useHudRoot } from "./hud-root.ts";

/** Keyboard focus (not a mouse click); true where `:focus-visible` is unsupported. */
function focusVisible(el: HTMLElement): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

export interface HoverCardProps {
  /** The trigger: one element that accepts props and a ref (rendered with asChild). */
  children: ReactElement;
  /** Card body. */
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  /** Off: render the trigger alone, with no card. */
  enabled?: boolean;
}

export function HoverCard({
  children,
  content,
  side = "top",
  align = "center",
  className,
  enabled = true,
}: HoverCardProps) {
  const [open, setOpen] = useState(false);
  const container = useHudRoot();
  const press = useLongPress(() => setOpen(true), enabled);
  if (!enabled) return children;
  return (
    <HoverCardPrimitive.Root open={open} onOpenChange={setOpen} openDelay={300} closeDelay={150}>
      <HoverCardPrimitive.Trigger
        asChild
        {...press}
        onFocus={(e) => {
          if (focusVisible(e.target as HTMLElement)) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {children}
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal container={container}>
        <HoverCardPrimitive.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          data-interactive
          data-slot="hover-card"
          data-testid="hover-card"
          onPointerDownOutside={() => setOpen(false)}
          onEscapeKeyDown={() => setOpen(false)}
          className={cn(
            "pointer-events-auto z-50 w-[min(300px,calc(100vw-16px))] rounded-none border border-gold/70 bg-paper px-3 py-2.5 text-[13px] leading-snug text-foreground shadow-lg shadow-black/40 data-[state=open]:animate-fade-in",
            className,
          )}
        >
          {content}
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
