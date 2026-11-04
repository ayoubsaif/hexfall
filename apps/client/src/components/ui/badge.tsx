// shadcn/ui Badge: small pill for counts, rates and tags.
import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-1.5 text-[11px] leading-[18px] font-semibold tabular-nums",
  {
    variants: {
      variant: {
        default: "bg-white/15 text-foreground",
        accent: "bg-primary text-primary-foreground",
        muted: "bg-black/40 text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
