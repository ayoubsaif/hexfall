// Text field drawn as inked parchment (`.hud-field` in style.css); a native <input> underneath.
import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "hud-field h-9 w-full min-w-0 px-3 py-1 text-base max-sm:h-10 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
