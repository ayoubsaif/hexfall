// shadcn/ui Sheet: a Radix dialog sliding in from an edge (the mobile event-log drawer).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SealIcon } from "./SealIcon.tsx";
import { cn } from "@/lib/utils.ts";
import { useHudRoot } from "./hud-root.ts";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  side = "right",
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  title: ReactNode;
  side?: "right" | "bottom";
}) {
  const container = useHudRoot();
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay
        data-interactive
        className="pointer-events-auto fixed inset-0 z-40 bg-black/45 data-[state=open]:animate-fade-in"
      />
      <DialogPrimitive.Content
        data-interactive
        aria-describedby={undefined}
        className={cn(
          "pointer-events-auto fixed z-50 flex flex-col gap-2 paper p-3 text-foreground outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-[min(340px,88vw)] data-[state=open]:animate-sheet-in-right"
            : "inset-x-0 bottom-0 max-h-[70vh] data-[state=open]:animate-sheet-in-bottom",
          className,
        )}
        {...props}
      >
        <div className="hud-leather hud-title flex items-center justify-between gap-2 !pr-3">
          <DialogPrimitive.Title className="font-serif text-lg font-semibold">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={t("session.ui.close")}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SealIcon className="size-full drop-shadow-md" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
