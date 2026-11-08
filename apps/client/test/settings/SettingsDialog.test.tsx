// Settings entry point and dialog (specs/client-settings).
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hud } from "../../src/hud/Hud.tsx";
import { i18n } from "../../src/i18n/index.ts";
import { SettingsDialog } from "../../src/settings/SettingsDialog.tsx";
import {
  SECTION_IDS,
  openSettings,
  setSettingsOpen,
  setSettingsSection,
  useSettingsStore,
} from "../../src/settings/sections.ts";
import {
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
  readPrefs,
  usePrefsStore,
} from "../../src/store/prefs.ts";
import { click, mount, resetAll, seatRoom, showGame, type Mounted } from "../hud/helpers.tsx";
import { playState } from "../game/fixtures.ts";

let m: Mounted | null = null;

const q = <E extends Element = HTMLElement>(sel: string) => document.querySelector<E>(sel);
const byTestId = <E extends Element = HTMLElement>(id: string) => q<E>(`[data-testid="${id}"]`);

async function openFromButton() {
  await act(async () => {
    m!.container.querySelector<HTMLButtonElement>('[data-testid="settings-button"]')!.click();
    await import("../../src/settings/SettingsDialog.tsx");
  });
  await act(async () => {});
}

beforeEach(() => {
  resetAll();
  usePrefsStore.setState({ ...DEFAULT_PREFS });
  useSettingsStore.setState({ open: false, section: "language" });
});

afterEach(async () => {
  act(() => setSettingsOpen(false));
  m?.unmount();
  m = null;
  resetAll();
  await act(async () => {
    await i18n.changeLanguage("en");
  });
  try {
    localStorage.removeItem(PREFS_STORAGE_KEY);
  } catch {
    // ignore
  }
});

describe("Settings entry point", () => {
  it("start screen: one Settings button that opens the dialog on its first section", async () => {
    m = mount(<Hud />);
    const buttons = m.container.querySelectorAll('[data-testid="settings-button"]');
    expect(buttons.length).toBe(1);
    expect(buttons[0]!.getAttribute("aria-label")).toBe("Settings");
    for (const old of ["language-switch", "sound-toggle", "notify-toggle", "credits-toggle"])
      expect(m.container.querySelector(`[data-testid="${old}"]`)).toBeNull();
    await openFromButton();
    const dialog = byTestId("settings-dialog");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(document.getElementById(dialog!.getAttribute("aria-labelledby")!)?.textContent).toBe(
      "Settings",
    );
    expect(byTestId("settings-section-language")).not.toBeNull();
  });

  it("lobby and game: still exactly one Settings button", () => {
    seatRoom(0);
    m = mount(<Hud />);
    expect(m.container.querySelectorAll('[data-testid="settings-button"]').length).toBe(1);
    showGame(playState({ seat: 0 }), 0);
    act(() => {});
    expect(m.container.querySelectorAll('[data-testid="settings-button"]').length).toBe(1);
  });

  it("Escape closes the dialog and returns focus to the Settings button", async () => {
    m = mount(<Hud />);
    await openFromButton();
    expect(byTestId("settings-dialog")).not.toBeNull();
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(byTestId("settings-dialog")).toBeNull();
    // Radix restores focus on a zero-delay timer after unmount.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.activeElement?.getAttribute("data-testid")).toBe("settings-button");
  });

  it("the close button closes the dialog", async () => {
    m = mount(<Hud />);
    await openFromButton();
    act(() => byTestId<HTMLButtonElement>("settings-close")!.click());
    expect(byTestId("settings-dialog")).toBeNull();
  });
});

describe("Settings dialog layout", () => {
  function render() {
    openSettings();
    m = mount(<SettingsDialog />);
  }

  it("lists the sections in order in the sidebar and the phone list", () => {
    render();
    const nav = SECTION_IDS.map((s) => byTestId(`settings-nav-${s}`)?.textContent);
    expect(nav).toEqual([
      "Language",
      "Sound",
      "Notifications",
      "Graphics",
      "Accessibility",
      "Keyboard",
      "Credits",
      "About",
    ]);
    const menu = SECTION_IDS.map((s) => byTestId(`settings-menu-${s}`)?.textContent);
    expect(menu).toEqual(nav);
    expect(document.querySelector("select")).toBeNull();
  });

  it("selecting Sound marks it active, updates the breadcrumb and shows the sound settings", () => {
    render();
    act(() => click(byTestId("settings-nav-sound")!));
    expect(byTestId("settings-nav-sound")?.getAttribute("data-active")).toBe("true");
    expect(byTestId("settings-nav-sound")?.getAttribute("aria-current")).toBe("page");
    expect(byTestId("settings-breadcrumb")?.textContent).toContain("Settings");
    expect(byTestId("settings-breadcrumb")?.textContent).toContain("Sound");
    expect(byTestId("settings-section-sound")).not.toBeNull();
  });

  it("the phone list opens a section, and Back returns to the list", () => {
    render();
    expect(byTestId("settings-menu")).not.toBeNull();
    expect(byTestId("settings-back")).toBeNull();
    act(() => click(byTestId("settings-menu-about")!));
    expect(byTestId("settings-section-about")).not.toBeNull();
    expect(byTestId("settings-menu")).toBeNull();
    expect(byTestId("settings-back")?.textContent).toBe("About");
    act(() => click(byTestId("settings-back")!));
    expect(byTestId("settings-menu")).not.toBeNull();
  });

  it("opening on a given section skips the list", () => {
    openSettings("keyboard");
    m = mount(<SettingsDialog />);
    expect(byTestId("settings-menu")).toBeNull();
    expect(byTestId("settings-back")?.textContent).toBe("Keyboard");
  });

  it("remembers the last section for the page session", () => {
    render();
    act(() => setSettingsSection("accessibility"));
    act(() => setSettingsOpen(false));
    act(() => openSettings());
    expect(byTestId("settings-section-accessibility")).not.toBeNull();
  });

  it("switching language updates the open dialog on the same section", async () => {
    render();
    const es = [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
      (b) => b.textContent === "Español",
    )!;
    await act(async () => es.click());
    expect(byTestId("settings-nav-language")?.textContent).toBe("Idioma");
    expect(byTestId("settings-breadcrumb")?.textContent).toContain("Ajustes");
    expect(byTestId("settings-section-language")).not.toBeNull();
  });

  it("volume and motion apply at once and persist", () => {
    render();
    act(() => setSettingsSection("accessibility"));
    const reduce = [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
      (b) => b.textContent === "Reduce motion",
    )!;
    act(() => reduce.click());
    expect(usePrefsStore.getState().motion).toBe("reduce");
    act(() => setSettingsSection("sound"));
    const thumb = q<HTMLElement>('[data-testid="settings-volume"] [role="slider"]')!;
    expect(thumb.getAttribute("aria-valuenow")).toBe("60");
    act(() => {
      thumb.focus();
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(usePrefsStore.getState().volume).toBe(0.55);
    expect(readPrefs()).toMatchObject({ volume: 0.55, motion: "reduce" });
  });

  it("graphics choices apply immediately and survive reopening", () => {
    render();
    act(() => setSettingsSection("graphics"));
    act(() =>
      byTestId("settings-graphics-mode")!
        .querySelector<HTMLButtonElement>('[data-value="classic"]')!
        .click(),
    );
    act(() =>
      byTestId("settings-graphics-quality")!
        .querySelector<HTMLButtonElement>('[data-value="low"]')!
        .click(),
    );
    expect(readPrefs()).toMatchObject({ graphicsMode: "classic", graphicsQuality: "low" });
    act(() => setSettingsOpen(false));
    act(() => openSettings());
    expect(
      byTestId("settings-graphics-mode")!
        .querySelector('[data-value="classic"]')
        ?.getAttribute("aria-checked"),
    ).toBe("true");
    expect(byTestId("settings-section-graphics")!.textContent).toContain("Current quality: Low");
  });

  it("About shows the version", () => {
    render();
    act(() => setSettingsSection("about"));
    expect(byTestId("settings-version")?.textContent).toMatch(/Version \d+\.\d+\.\d+/);
  });

  it("Credits shows the author, the music with its links and the theme credits", () => {
    render();
    act(() => setSettingsSection("credits"));
    const author = byTestId("settings-author")?.querySelector("a");
    expect(author?.textContent).toBe("@ayoubsaif");
    expect(author?.getAttribute("href")).toBe("https://github.com/ayoubsaif");
    const links = [...(byTestId("settings-music-credits")?.querySelectorAll("a") ?? [])];
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Fertility", "https://pixabay.com/music/ambient-fertility-322747/"],
      ["Syouki Takahashi", "https://pixabay.com/users/syouki_takahashi-3820204/"],
      ["Pixabay Content License", "https://pixabay.com/service/license-summary/"],
    ]);
    for (const l of links) expect(l.getAttribute("rel")).toBe("noopener noreferrer");
    expect(byTestId("settings-section-credits")?.textContent).toContain("Art");
  });
});
