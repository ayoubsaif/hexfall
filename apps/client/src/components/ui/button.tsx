// shadcn/ui Button, adapted to the Hexfall tokens.
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export const buttonVariants = cva(
  "pointer-events-auto inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-none font-semibold whitespace-nowrap transition-[filter,background-color,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        menu: "game-mode-button",
        default:
          "border border-gold bg-linear-to-b from-[#6b4228] to-leather font-serif text-[1.05em] tracking-wide text-cream shadow-[inset_0_1px_0_rgb(255_235_200/25%),0_2px_0_rgb(0_0_0/30%)] hover:brightness-125",
        secondary:
          "frame [--corner-size:12px] border border-gold/60 bg-cream/60 text-foreground hover:bg-cream/90 aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-cream data-[selected]:border-forest data-[selected]:bg-forest data-[selected]:text-cream",
        ghost: "bg-transparent text-muted-foreground hover:bg-ink/10 hover:text-foreground",
        link: "bg-transparent p-0 text-forest underline underline-offset-2",
        destructive: "bg-bad text-cream hover:brightness-110",
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
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
