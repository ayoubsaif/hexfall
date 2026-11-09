// Rules guide open state (openspec tutorial-mode-and-rules-guide, specs/rules-guide; design
// decision 6). The start screen, the HUD info button and the tutorial hint all open it here.
import { create } from "zustand";

/** Sections in display order; ids match the illustration files in public/rules/. */
export const RULES_SECTIONS = [
  "goal",
  "setup",
  "turn",
  "production",
  "building",
  "robber",
  "devCards",
  "trading",
  "special",
  "winning",
] as const;
export type RulesSection = (typeof RULES_SECTIONS)[number];

interface RulesGuideState {
  open: boolean;
  section: RulesSection;
}

export const useRulesGuideStore = create<RulesGuideState>(() => ({
  open: false,
  section: "goal",
}));

/** Opens the guide at `section` (default: the first section). */
export function openRulesGuide(section: RulesSection = "goal"): void {
  useRulesGuideStore.setState({ open: true, section });
}

export function setRulesSection(section: RulesSection): void {
  useRulesGuideStore.setState({ section });
}

export function closeRulesGuide(): void {
  useRulesGuideStore.setState({ open: false });
}
