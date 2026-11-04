import { createContext, useContext } from "react";
import { DEFAULT_THEME_ID, themeBaseUrl } from "./load.ts";
import type { ResolvedTheme } from "./resolve.ts";

export interface ThemeState {
  status: "loading" | "ready";
  theme: ResolvedTheme;
}

/** Before the manifest arrives every key is procedural, so the scene never waits. */
export const PROCEDURAL_THEME_STATE: ThemeState = {
  status: "loading",
  theme: {
    id: DEFAULT_THEME_ID,
    baseUrl: themeBaseUrl(import.meta.env.BASE_URL ?? "/", DEFAULT_THEME_ID),
    entries: {},
  },
};

export const ThemeContext = createContext<ThemeState>(PROCEDURAL_THEME_STATE);

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
