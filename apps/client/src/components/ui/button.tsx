// shadcn/ui Button, adapted to the Hexfall tokens.
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentProps, MouseEvent } from "react";
import { cn } from "@/lib/utils.ts";
import { playSound } from "../../audio/sounds.ts";

export const buttonVariants = cva(
  "pointer-events-auto inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-none font-semibold whitespace-nowrap transition-[filter,background-color,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        menu: "game-mode-button btn-light",
        default:
          "btn-light wood-button rounded-lg font-serif text-[1.05em] tracking-wide text-cream",
        secondary:
          "frame btn-light [--corner-size:12px] border border-gold/60 bg-cream/60 text-foreground hover:bg-cream/90 aria-pressed:border-gold aria-pressed:bg-linear-to-b aria-pressed:from-[#6b4228] aria-pressed:to-leather aria-pressed:text-cream aria-pressed:shadow-[inset_0_1px_0_rgb(255_235_200/25%)] data-[selected]:border-gold data-[selected]:bg-linear-to-b data-[selected]:from-[#6b4228] data-[selected]:to-leather data-[selected]:text-cream data-[selected]:shadow-[inset_0_1px_0_rgb(255_235_200/25%)]",
        ghost: "bg-transparent text-muted-foreground hover:bg-ink/10 hover:text-foreground",
        link: "bg-transparent p-0 text-forest underline underline-offset-2",
        destructive: "btn-light bg-bad text-cream",
      },
      size: {
        default: "min-h-9 px-3.5 py-1.5 text-sm max-sm:min-h-10 short:min-h-10",
        sm: "min-h-8 px-2.5 text-xs before:hidden! max-sm:min-h-10 short:min-h-10",
        icon: "size-9 before:hidden! max-sm:size-10 short:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a <button> (Radix Slot). */
  asChild?: boolean;
  /** Play the burn sound on press. Default: on for main (default variant) buttons only. */
  sound?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  sound,
  onClick,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const burns = sound ?? (variant ?? "default") === "default";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (burns) playSound("burn");
        onClick?.(e);
      }}
      {...props}
    />
  );
}
