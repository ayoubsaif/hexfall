// Binds the pure land-relief rule (relief.ts) to the active theme.
import { useMemo } from "react";
import { useTheme } from "./context.ts";
import { type LandRelief, landRelief } from "./relief.ts";

export function useLandRelief(): LandRelief {
  const { theme } = useTheme();
  return useMemo(() => landRelief(theme.entries), [theme.entries]);
}
