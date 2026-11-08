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
  hideHeader = false,
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  /** Visible heading and accessible name. */
  title: ReactNode;
  /** Optional visible description (also the accessible description). */
  description?: ReactNode;
  /** Keep title and description for assistive tech only (the dialog draws its own header). */
  hideHeader?: boolean;
}) {
  const container = useHudRoot();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay
        data-interactive
        className="pointer-events-auto fixed inset-0 z-40 bg-black/45 data-[state=open]:animate-fade-in"
      />
      <DialogPrimitive.Content
        data-interactive
        className={cn(
          "pointer-events-auto fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-32px)] w-[min(380px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden frame frame-brass frame-corners paper rounded-none text-foreground outline-none data-[state=open]:animate-dialog-in",
          className,
        )}
        {...(description === undefined ? { "aria-describedby": undefined } : {})}
        {...props}
      >
        {/* Corner plates live on this fixed box; the body scrolls inside it. */}
        <div className={hideHeader ? "contents" : "min-h-0 flex-1 overflow-auto p-6"}>
          <DialogPrimitive.Title
            className={
              hideHeader
                ? "sr-only"
                : "mb-4 border-b border-border pb-3 font-serif text-2xl font-semibold text-forest"
            }
          >
            {title}
          </DialogPrimitive.Title>
          {description !== undefined && (
            <DialogPrimitive.Description
              className={hideHeader ? "sr-only" : "mb-2 text-xs text-muted-foreground"}
            >
              {description}
            </DialogPrimitive.Description>
          )}
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-3 flex flex-wrap justify-end gap-2", className)} {...props} />;
}
