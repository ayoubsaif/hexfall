// shadcn/ui Dialog on Radix, portalled into the HUD root (design decision 3).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils.ts";
import { useHudRoot } from "./hud-root.ts";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  /** Visible heading and accessible name. */
  title: ReactNode;
  /** Optional visible description (also the accessible description). */
  description?: ReactNode;
}) {
  const container = useHudRoot();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay
        data-interactive
        className="pointer-events-auto fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-fade-in"
      />
      <DialogPrimitive.Content
        data-interactive
        className={cn(
          "pointer-events-auto fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-32px)] w-[min(380px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl bg-hud-solid/95 p-4 text-foreground shadow-xl shadow-black/40 backdrop-blur-md outline-none data-[state=open]:animate-dialog-in",
          className,
        )}
        {...(description === undefined ? { "aria-describedby": undefined } : {})}
        {...props}
      >
        <DialogPrimitive.Title className="mb-2 text-base font-semibold">
          {title}
        </DialogPrimitive.Title>
        {description !== undefined && (
          <DialogPrimitive.Description className="mb-2 text-xs text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-3 flex justify-end gap-2", className)} {...props} />;
}
