// specs/client-i18n "Event log in the viewer's language" and "All user-facing text is
// translated": the log re-renders existing lines on a language switch.
import type { GameEvent } from "@hexfall/engine";
import { act } from "react";
import { afterEach, describe as suite, expect, it } from "vite-plus/test";
import { describe } from "../../src/game/describe.ts";
import { EventLog } from "../../src/hud/Feed.tsx";
import { namesFrom } from "../../src/hud/names.ts";
import { fixedT, i18n } from "../../src/i18n/index.ts";
import { resetGame, useGameStore } from "../../src/store/game.ts";
import { mount, type Mounted } from "../hud/helpers.tsx";

const LOG: GameEvent[] = [
  { type: "diceRolled", seat: 0, dice: [2, 4], total: 6 },
  { type: "produced", seat: 1, resources: { brick: 1 } },
  { type: "produced", seat: 0, resources: { ore: 2, wool: 1 } },
  { type: "turnEnded", seat: 0 },
];

let m: Mounted | null = null;

afterEach(async () => {
  m?.unmount();
  m = null;
  resetGame();
  await act(() => i18n.changeLanguage("en"));
});

const lines = () =>
  [...(m?.container.querySelectorAll<HTMLElement>("[data-testid=log-line]") ?? [])].map(
    (l) => l.textContent,
  );

suite("event log language", () => {
  it("shows the empty-log text and the log name in the active language", async () => {
    m = mount(<EventLog />);
    expect(m.container.querySelector("[data-testid=log-empty]")?.textContent).toBe(
      "No events yet.",
    );
    await act(() => i18n.changeLanguage("es"));
    expect(m.container.querySelector("[data-testid=log-empty]")?.textContent).toBe(
      "Aún no hay eventos.",
    );
    expect(m.container.querySelector("[aria-label]")?.getAttribute("aria-label")).toBe(
      "Registro de la partida",
    );
  });

  it("re-renders existing lines in Spanish after a switch", async () => {
    useGameStore.setState({ log: LOG });
    m = mount(<EventLog />);
    const english = lines();
    expect(english).toHaveLength(LOG.length);

    await act(() => i18n.changeLanguage("es"));
    const names = namesFrom([], fixedT("es"));
    const expected = LOG.map((e, i) => describe(e, names, fixedT("es"), LOG[i + 1]).text);
    expect(lines()).toEqual(expected);
    expect(lines()).not.toEqual(english);
  });
});
