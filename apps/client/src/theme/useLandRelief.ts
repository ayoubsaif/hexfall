// Binds the pure land-relief rule (relief.ts) to the active theme and board style.
import { useMemo } from "react";
import { useTheme } from "./context.ts";
import { type LandRelief, landRelief } from "./relief.ts";
import { useBoardStyle } from "./style.ts";

export function useLandRelief(): LandRelief {
  const { theme } = useTheme();
  const { style } = useBoardStyle();
  return useMemo(() => landRelief(theme.entries, style), [theme.entries, style]);
}
