import { type ReactNode, useEffect, useState } from "react";
import { PROCEDURAL_THEME_STATE, ThemeContext, type ThemeState } from "./context.ts";
import { type ThemeLoadResult, httpManifestFetcher, loadTheme } from "./load.ts";

const APP_BASE: string = import.meta.env.BASE_URL ?? "/";

// One load per page (also under StrictMode double effects); messages are logged once.
let pending: Promise<ThemeLoadResult> | undefined;
function loadOnce(): Promise<ThemeLoadResult> {
  pending ??= loadTheme(import.meta.env.VITE_THEME, httpManifestFetcher(APP_BASE), APP_BASE).then(
    (result) => {
      for (const m of result.messages) {
        if (m.level === "error") console.error(`[theme] ${m.text}`);
        else console.warn(`[theme] ${m.text}`);
      }
      return result;
    },
  );
  return pending;
}

/**
 * Loads the theme selected by VITE_THEME (default "diorama") and exposes the resolved
 * key map. Children render immediately with procedural fallbacks while it loads.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(PROCEDURAL_THEME_STATE);
  useEffect(() => {
    let alive = true;
    loadOnce().then(
      ({ theme }) => {
        if (alive) setState({ status: "ready", theme });
      },
      (error: unknown) => {
        console.error("[theme] theme loading crashed; using procedural fallbacks.", error);
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return <ThemeContext value={state}>{children}</ThemeContext>;
}
