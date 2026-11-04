// shadcn/ui Button, adapted to the Hexfall tokens.
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export const buttonVariants = cva(
  "pointer-events-auto inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md font-semibold whitespace-nowrap transition-[filter,background-color,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110",
        secondary: "bg-white/10 text-foreground hover:bg-white/15",
        ghost: "bg-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground",
        link: "bg-transparent p-0 text-primary underline underline-offset-2",
        destructive: "bg-bad text-accent-fg hover:brightness-110",
      },
      size: {
        default: "min-h-9 px-3.5 py-1.5 text-sm max-sm:min-h-10 short:min-h-10",
        sm: "min-h-8 px-2.5 text-xs max-sm:min-h-10 short:min-h-10",
        icon: "size-9 max-sm:size-10 short:size-10",
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
