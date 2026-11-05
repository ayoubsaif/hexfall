// shadcn/ui Tabs on Radix (the log drawer's Log / Dice tabs).
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils.ts";

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn("flex min-h-0 flex-col gap-2", className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex shrink-0 gap-1 rounded-lg bg-white/5 p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-white/10 data-[state=active]:text-foreground motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("flex min-h-0 flex-1 flex-col outline-none", className)}
      {...props}
    />
  );
}
