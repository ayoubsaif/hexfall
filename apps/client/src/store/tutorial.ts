// Tutorial mode on/off, kept in the `hexfall_tutorial` cookie (openspec
// tutorial-mode-and-rules-guide, specs/tutorial-mode "Tutorial on by default", "Turning tutorial
// off and on"; design decision 1). The server never reads it. When the cookie cannot be written
// the choice lives in memory for the page session.
import { create } from "zustand";

export const TUTORIAL_COOKIE = "hexfall_tutorial";
/** 365 days. */
export const TUTORIAL_MAX_AGE = 31536000;

/** The stored choice in a `document.cookie` string, or null (no cookie or an unknown value). */
export function parseTutorialCookie(cookie: string): boolean | null {
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== TUTORIAL_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    if (value === "on") return true;
    if (value === "off") return false;
    return null;
  }
  return null;
}

/** The `document.cookie` assignment that stores `enabled`. */
export function serializeTutorialCookie(enabled: boolean, https: boolean): string {
  return `${TUTORIAL_COOKIE}=${enabled ? "on" : "off"}; Path=/; Max-Age=${TUTORIAL_MAX_AGE}; SameSite=Lax${https ? "; Secure" : ""}`;
}

/** Read once at startup: on unless the cookie says off. */
export function readTutorialEnabled(): boolean {
  try {
    return parseTutorialCookie(document.cookie) ?? true;
  } catch {
    return true;
  }
}

interface TutorialState {
  enabled: boolean;
}

export const useTutorial = create<TutorialState>(() => ({ enabled: readTutorialEnabled() }));

/** Applies at once and writes the cookie; a failed write keeps the choice in memory only. */
export function setTutorialEnabled(enabled: boolean): void {
  useTutorial.setState({ enabled });
  try {
    document.cookie = serializeTutorialCookie(enabled, location.protocol === "https:");
  } catch {
    // Cookies blocked: the choice lasts for this page session.
  }
}
