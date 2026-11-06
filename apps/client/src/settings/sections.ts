// Settings sections in display order (specs/client-settings "Settings dialog layout") and the
// last one opened, remembered for the page session only.
import { create } from "zustand";

export const SECTION_IDS = [
  "language",
  "sound",
  "notifications",
  "graphics",
  "accessibility",
  "keyboard",
  "about",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export function isSectionId(v: string): v is SectionId {
  return (SECTION_IDS as readonly string[]).includes(v);
}

interface SettingsState {
  open: boolean;
  section: SectionId;
}

export const useSettingsStore = create<SettingsState>()(() => ({
  open: false,
  section: "language",
}));

export function openSettings(section?: SectionId): void {
  useSettingsStore.setState(section ? { open: true, section } : { open: true });
}

export function setSettingsOpen(open: boolean): void {
  useSettingsStore.setState({ open });
}

export function setSettingsSection(section: SectionId): void {
  useSettingsStore.setState({ section });
}

let trigger: HTMLElement | null = null;

/** The Settings button registers itself so closing the dialog can return focus to it. */
export function registerSettingsTrigger(el: HTMLElement | null): void {
  trigger = el;
}

export function settingsTrigger(): HTMLElement | null {
  return trigger;
}
