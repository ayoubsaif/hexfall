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
  /** Below md only: show the section list instead of a section (md+ always shows both). */
  list: boolean;
}

export const useSettingsStore = create<SettingsState>()(() => ({
  open: false,
  section: "language",
  list: true,
}));

/** Opens Settings: on the section list (phones), or straight on `section` when one is given. */
export function openSettings(section?: SectionId): void {
  useSettingsStore.setState(
    section ? { open: true, section, list: false } : { open: true, list: true },
  );
}

export function setSettingsOpen(open: boolean): void {
  useSettingsStore.setState({ open });
}

/** Picks a section (and leaves the phone list for it). */
export function setSettingsSection(section: SectionId): void {
  useSettingsStore.setState({ section, list: false });
}

/** Phones: back from a section to the section list. */
export function showSettingsList(): void {
  useSettingsStore.setState({ list: true });
}

let trigger: HTMLElement | null = null;

/** The Settings button registers itself so closing the dialog can return focus to it. */
export function registerSettingsTrigger(el: HTMLElement | null): void {
  trigger = el;
}

export function settingsTrigger(): HTMLElement | null {
  return trigger;
}
