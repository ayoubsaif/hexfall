// Language choice in Settings (specs/client-i18n, "Manual language choice", "Document language").
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hud } from "../../src/hud/Hud.tsx";
import { StartScreen } from "../../src/hud/StartScreen.tsx";
import { dismissWelcome } from "../../src/hud/Welcome.tsx";
import { i18n } from "../../src/i18n/index.ts";
import { LANGUAGE_STORAGE_KEY } from "../../src/i18n/language.ts";
import { LanguageSection as LanguageSwitch } from "../../src/settings/sections/LanguageSection.tsx";
import { setSettingsOpen } from "../../src/settings/sections.ts";
import { resetRoom } from "../../src/store/room.ts";
import { mount, type Mounted } from "../hud/helpers.tsx";

let m: Mounted | null = null;

function radio(container: HTMLElement, name: string): HTMLButtonElement {
  const el = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
    (b) => b.textContent === name,
  );
  if (!el) throw new Error(`no radio "${name}"`);
  return el;
}

beforeEach(() => {
  resetRoom();
  try {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // ignore
  }
});

afterEach(async () => {
  m?.unmount();
  m = null;
  await act(async () => {
    await i18n.changeLanguage("en");
  });
  try {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // ignore
  }
});

function groupName(container: HTMLElement): string | null | undefined {
  const id = container.querySelector('[role="radiogroup"]')?.getAttribute("aria-labelledby");
  return id ? document.getElementById(id)?.textContent : null;
}

describe("LanguageSection", () => {
  it("lists each language by its own name, with a translated group name", () => {
    m = mount(<LanguageSwitch />);
    expect(groupName(m.container)).toBe("Language");
    const names = [...m.container.querySelectorAll('[role="radio"]')].map((b) => b.textContent);
    expect(names).toEqual(["English", "Español"]);
    expect(radio(m.container, "English").getAttribute("aria-checked")).toBe("true");
  });

  it("switching to Español changes the language, <html lang> and the saved choice", () => {
    m = mount(<LanguageSwitch />);
    act(() => radio(m!.container, "Español").click());
    expect(i18n.language).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");
    expect(radio(m.container, "Español").getAttribute("aria-checked")).toBe("true");
    expect(groupName(m.container)).toBe("Idioma");
  });

  it("the start screen re-renders in Spanish after switching", () => {
    m = mount(
      <>
        <LanguageSwitch />
        <StartScreen />
      </>,
    );
    expect(m.container.textContent).toContain("Create room");
    act(() => radio(m!.container, "Español").click());
    expect(m.container.textContent).toContain("Crear sala");
    expect(m.container.textContent).toContain("Tu nombre");
    expect(m.container.textContent).not.toContain("Create room");
  });

  it("is reached from the Settings button on the start screen of the HUD", async () => {
    dismissWelcome();
    m = mount(<Hud />);
    expect(m.container.querySelectorAll('[data-testid="settings-button"]').length).toBe(1);
    expect(m.container.textContent).toContain("Create room");
    await act(async () => {
      m!.container.querySelector<HTMLButtonElement>('[data-testid="settings-button"]')!.click();
      await import("../../src/settings/SettingsDialog.tsx");
    });
    await act(async () => {});
    act(() => radio(document.body, "Español").click());
    expect(m.container.textContent).toContain("Crear sala");
    expect(document.querySelector('[data-testid="settings-dialog"]')?.textContent).toContain(
      "Idioma",
    );
    act(() => setSettingsOpen(false));
  });
});
