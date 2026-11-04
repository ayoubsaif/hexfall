// Game text in Spanish (specs/client-i18n "All user-facing text is translated",
// "Event log in the viewer's language"): log lines, toasts, status, errors, labels.
import type { GameEvent } from "@hexfall/engine";
import { describe as suite, expect, it } from "vite-plus/test";
import { formatBundle } from "../../src/game/cards.ts";
import { seatColorName } from "../../src/game/colors.ts";
import { type Names, describe, toastFor } from "../../src/game/describe.ts";
import { statusOf } from "../../src/game/status.ts";
import { countdownText } from "../../src/hud/countdown.ts";
import { roomErrorText, ruleErrorText } from "../../src/hud/errors.ts";
import { namesFrom } from "../../src/hud/names.ts";
import { fixedT } from "../../src/i18n/index.ts";
import { playState, seen, setupState } from "../game/fixtures.ts";

const es = fixedT("es");
const en = fixedT("en");
const names: Names = (s) => ["Ana", "Ben", "Cy", "Dee"][s]!;

suite("log lines in Spanish", () => {
  it("dice roll", () => {
    const e: GameEvent = { type: "diceRolled", seat: 0, dice: [2, 3], total: 5 };
    expect(describe(e, names, es).text).toBe("Ana sacó 2 + 3 = 5.");
  });

  it("steal, hidden and known", () => {
    expect(describe({ type: "stole", thief: 0, victim: 1, resource: null }, names, es).text).toBe(
      "Ana robó una carta a Ben.",
    );
    expect(describe({ type: "stole", thief: 0, victim: 1, resource: "ore" }, names, es).text).toBe(
      "Ana robó 1 de mineral a Ben.",
    );
  });

  it("production of 1 and of 3 cards", () => {
    expect(describe({ type: "produced", seat: 1, resources: { wool: 1 } }, names, es).text).toBe(
      "Ben recibió 1 de lana.",
    );
    expect(
      describe({ type: "produced", seat: 1, resources: { grain: 2, ore: 1 } }, names, es).text,
    ).toBe("Ben recibió 2 de grano y 1 de mineral.");
  });

  it("development card purchase", () => {
    expect(describe({ type: "devCardBought", seat: 0, card: null }, names, es).text).toBe(
      "Ana compró una carta de desarrollo.",
    );
    expect(describe({ type: "devCardBought", seat: 0, card: "knight" }, names, es).text).toBe(
      "Ana compró una carta de desarrollo (Caballero).",
    );
  });

  it("plurals follow the count", () => {
    const one = describe({ type: "largestArmy", to: 0, from: null, knights: 1 }, names, es);
    const many = describe({ type: "largestArmy", to: 0, from: null, knights: 3 }, names, es);
    expect(one.text).toBe("Ana se lleva el Gran Ejército (1 caballero).");
    expect(many.text).toBe("Ana se lleva el Gran Ejército (3 caballeros).");
    expect(describe({ type: "vpRevealed", seat: 0, count: 1 }, names, en).text).toBe(
      "Ana revealed 1 Victory Point card.",
    );
  });

  it("lists join with 'y' and a timeout names everyone", () => {
    expect(formatBundle({ brick: 1, grain: 1, ore: 1 }, es)).toBe(
      "1 de ladrillo, 1 de grano y 1 de mineral",
    );
    const e: GameEvent = { type: "timedOut", phase: "discard", seats: [1, 2, 3] };
    expect(describe(e, names, es).text).toBe(
      "Se acabó el tiempo de Ben, Cy y Dee: cartas descartadas.",
    );
  });

  it("toasts", () => {
    expect(toastFor({ type: "turnStarted", seat: 1, number: 4 }, 1, names, es)?.text).toBe(
      "Tu turno",
    );
    expect(
      toastFor({ type: "diceRolled", seat: 0, dice: [3, 4], total: 7 }, 2, names, es)?.text,
    ).toBe("¡Un 7! El ladrón se mueve.");
  });
});

suite("status in Spanish", () => {
  it("setup", () => {
    const s = setupState();
    expect(statusOf(seen(s, 0).view, names, es).text).toBe("Coloca tu primer poblado");
    expect(statusOf(seen(s, 2).view, names, es).text).toBe("Ana está colocando un poblado");
  });

  it("rolling", () => {
    expect(statusOf(seen(playState({ rolled: false }), 0).view, names, es).text).toBe(
      "Tira los dados",
    );
    expect(statusOf(seen(playState({ rolled: false }), 1).view, names, es).text).toBe(
      "Ana va a tirar",
    );
  });

  it("discard", () => {
    const s = playState();
    s.phase = { kind: "discard", owed: [0, 4, 0, 1] };
    expect(statusOf(seen(s, 1).view, names, es).text).toBe("¡Un 7! Descarta 4 cartas");
    expect(statusOf(seen(s, 3).view, names, es).text).toBe("¡Un 7! Descarta 1 carta");
    expect(statusOf(seen(s, 0).view, names, es).text).toBe(
      "¡Un 7! Esperando a que Ben, Dee descarte",
    );
  });
});

suite("errors and labels in Spanish", () => {
  it("known rule and room codes", () => {
    expect(ruleErrorText("not_your_turn", "server text", es)).toBe("No es tu turno.");
    expect(roomErrorText("room_full", "server text", es)).toBe("Esa sala está llena.");
  });

  it("an unknown code falls back to the server's message", () => {
    expect(ruleErrorText("brand_new_code", "Server says no", es)).toBe("Server says no");
  });

  it("seat fallback, seat color and countdown", () => {
    expect(namesFrom([], es)(2)).toBe("Asiento 3");
    expect(namesFrom([], en)(2)).toBe("Seat 3");
    expect(seatColorName(1, es)).toBe("Azul");
    expect(countdownText(1, es)).toBe("Queda 1 segundo");
    expect(countdownText(38, es)).toBe("Quedan 38 segundos");
  });
});
