// In-game HUD controls in Spanish (specs/client-i18n "All user-facing text is translated").
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hand } from "../../src/hud/Hand.tsx";
import { PlayerPanels } from "../../src/hud/PlayerPanels.tsx";
import { ActionButtons } from "../../src/hud/actions/ActionButtons.tsx";
import { i18n } from "../../src/i18n/index.ts";
import { give, playState } from "../game/fixtures.ts";
import {
  type Mounted,
  mount,
  recordSession,
  resetAll,
  seatRoom,
  showGame,
} from "../hud/helpers.tsx";

let m: Mounted | undefined;

beforeEach(async () => {
  resetAll();
  recordSession();
  await i18n.changeLanguage("es");
});
afterEach(async () => {
  m?.unmount();
  m = undefined;
  resetAll();
  await i18n.changeLanguage("en");
});

const labels = (root: ParentNode) =>
  [...root.querySelectorAll("[aria-label]")].map((el) => el.getAttribute("aria-label"));

describe("play controls in Spanish", () => {
  it("action buttons have Spanish names and costs", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<ActionButtons />);
    const names = labels(m.container);
    expect(names).toContain("Acciones del turno");
    expect(names).toContain("Construir carretera");
    expect(names).toContain("Terminar turno");
    expect(names).toContain("Comerciar con la banca");
    expect(m.container.textContent).toContain("Cuesta 1 de Madera, 1 de Ladrillo");
    expect(m.container.textContent).not.toMatch(/Costs|Build road|End turn/);
  });

  it("the hand and its cards are named in Spanish", () => {
    const s = playState();
    give(s, 0, { brick: 3 });
    seatRoom(0);
    showGame(s, 0);
    m = mount(<Hand />);
    expect(labels(m.container)).toContain("Tu mano");
    expect(m.container.textContent).toContain("Ladrillo, 3");
    expect(m.container.textContent).not.toContain("Brick");
  });

  it("player panels use Spanish labels", () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<PlayerPanels />);
    expect(labels(m.container)).toContain("Jugadores");
    expect(m.container.textContent).toContain("Caballeros");
    expect(m.container.textContent).toContain("tú");
  });

  it("switching back to English re-renders the controls", async () => {
    seatRoom(0);
    showGame(playState(), 0);
    m = mount(<ActionButtons />);
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(labels(m.container)).toContain("End turn");
  });
});
